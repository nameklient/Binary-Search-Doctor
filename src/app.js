import "./style.css";

import { loadPyodide } from "pyodide";
const pyodide = await loadPyodide({
    indexURL: "/pyodide/"
});

//console.log(pyodide.runPython("67")); 
import * as monaco from 'monaco-editor';
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker';
import cssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker';
import htmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker';
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker';

// Define the environment worker provider for Vite
self.MonacoEnvironment = {
  getWorker(_, label) {
    if (label === 'json') {
      return new jsonWorker();
    }
    if (label === 'css' || label === 'scss' || label === 'less') {
      return new cssWorker();
    }
    if (label === 'html' || label === 'handlebars' || label === 'razor') {
      return new htmlWorker();
    }
    if (label === 'typescript' || label === 'javascript') {
      return new tsWorker();
    }
    return new editorWorker();
  }
};

/**NOTE:
 * This is the absolute worst code that any human has written
 * I have no idea what I was thinking while designing this madness or whether I was thinking at all
 * I shouldve chosen a better infrastructure for my code, maybe ill add documentation
 * Please do not touch anything or try to maintain this - it seems to work
 * Hours wasted here: 24
 */

/**TODO:
 * - stop binary search if reset button is clicked
 * - remove any highlights if reset button is clicked
 * - 
 */


/**highlights a certain line of an editor
 * 
 */
function highlightLine(
    editor,
    startingLine,
    endingLine
){  
    clearHighlights(editor);
    editor.__activeDecorations = editor.deltaDecorations([], [
        {
            range: new monaco.Range(startingLine, 1, endingLine, 1),
            options: {
                className: 'highlighted-line',
                isWholeLine: true
            }
        }
    ]);
}

function clearHighlights(editor){
    const oldDecor = editor.__activeDecorations || [];
    editor.__activeDecorations = editor.deltaDecorations(oldDecor, []);
}

async function resetBoxes(
    boxes,
    left,
    right,
    mid,
    delay,
    stopSignal
){
    for(let i = left; i <= right; i++){
        if(i === mid) continue;
        await sleep(delay * 0.25, stopSignal); 
        const box = boxes[i];
        if(!box) continue;
        box.classList.remove("active_box");
        box.classList.remove("inactive_box");
    };
}

async function markBoxesInactive(
    boxes,
    left,
    right,
    delay,
    stopSignal
){
    for(let i = left; i <= right; i++){
        await sleep(delay * 0.1, stopSignal); 
        const box = boxes[i];
        if(!box) continue;
        box.classList.remove("active_box");
        box.classList.add("inactive_box");
    };
}

//hre for readability
function getStartLine(
    targetLang,
    actionId
){
    return targetLang[actionId][0];
}

//here for readability
function getEndLine(
    targetLang,
    actionId
){
    return targetLang[actionId][1];
}

//does waht it says
function disableElement(element, disable){
    if(disable) element.disabled = true;
    else element.disabled = false;
}

//outputs action to terminal
async function outputAction(
    outputTerminal, 
    action, 
    arr,
    lo, 
    hi, 
    mid, 
    target
){
    const id = "standard_bs_event_" + action;
    const rawString = String(await getText(id));

    const actionLog = document.createElement("div");
    actionLog.classList.add("output_string");

    const formatted = rawString.replace("{left}", lo)
        .replace("{right}", hi)
        .replace("{mid}", mid)
        .replace("{val}", arr[mid])
        .replace("{target}", target)
        .replace("{equal}", (arr[mid] != target ? "not" : ""))
        .replace("{lessEqual}", (lo > hi ? "not" : ""))
        .replace("{less}", (arr[mid] > target ? "not" : ""));
    
    actionLog.textContent = formatted;
    outputTerminal.append(actionLog);
    outputTerminal.scrollTop = outputTerminal.scrollHeight;
}

/**executes the entire binary search AND the animation
 * idk how to sync them otherwise
 * 
 * TODO:
 * - add stop button (make sure abort controller handling is implemented)
 * - add navigation bar
 * - add the entire tryout section
 */

async function runStandardBinarySearch(
    display, 
    arr, 
    target,
    delay,
    outputTerminal,
    editor,
    language,
    stopSignal
    ){
    if(!Array.isArray(arr)) throw new TypeError("runStandardBinarySearch: input was not an array");
    if(!Number.isInteger(Number(target))) throw new TypeError("runStandardBinarySearch: target was not an integer");
    if(isNaN(Number(delay)))  throw new TypeError("runStandardBinarySearch: delay was not a number");
    if(typeof language !== "string")  throw new TypeError("runStandardBinarySearch: language was not a string");
    
    const boxes = Array.from( document.querySelectorAll(".array_value_container_active:not(.removed_box)") );
    if(boxes.length !== arr.length) console.error(`The lengths of boxes and the array does not match ${boxes.length}, ${arr.length}`);
    
    boxes.forEach((box) => {
        box.classList.remove(
            "found_box",
            "active_box",
            "inactive_box"
        );
        box.classList.add("active_box");
    });

    target = Number(target);

    try{
        const id = language + "_highlights";
        const data_response = await fetch("/texts.json");
        const data = await data_response.json();
        const targetLang = data.find((text) => text.id === id);
        if(!targetLang){
            throw new Error(`getText: no text found with id ${id}`);
        }

        highlightLine(
            editor,
            getStartLine(targetLang, "CALL_FUNC"),
            getEndLine(targetLang, "CALL_FUNC")
        );
        await outputAction(outputTerminal, "CALL_FUNC", arr, -1, -1, -1, target);
        await sleep(delay, stopSignal);

        const n = arr.length;
        let lo = 0;
        highlightLine(
            editor,
            getStartLine(targetLang, "INIT_LO"),
            getEndLine(targetLang, "INIT_LO")
        );
        await outputAction(outputTerminal, "INIT_LO", arr, lo, n-1, n-1, target);
        await sleep(delay, stopSignal);

        let hi = n-1;
        highlightLine(
            editor,
            getStartLine(targetLang, "INIT_HI"),
            getEndLine(targetLang, "INIT_HI")
        );
        await outputAction(outputTerminal, "INIT_HI", arr, lo, hi, n-1, target);
        await sleep(delay, stopSignal);

        while(lo <= hi){
            highlightLine(
                editor,
                getStartLine(targetLang, "WHILE_HEAD"),
                getEndLine(targetLang, "WHILE_HEAD")
            );
            await outputAction(outputTerminal, "WHILE_HEAD", arr, lo, hi, n-1, target);
            await sleep(delay, stopSignal);

            let mid = Math.floor((lo + hi) / 2);
            highlightLine(
                editor,
                getStartLine(targetLang, "INIT_MID"),
                getEndLine(targetLang, "INIT_MID")
            );
            await outputAction(outputTerminal, "INIT_MID", arr, lo, hi, mid, target);
            await sleep(delay, stopSignal);

            const val = Number(arr[mid]);

            highlightLine(
                editor,
                getStartLine(targetLang, "IF"),
                getEndLine(targetLang, "IF")
            );
            await outputAction(outputTerminal, "IF", arr, lo, hi, mid, target);
            await sleep(delay, stopSignal);
            if(val === target){
                const found = boxes[mid];
                if(!found){ 
                    console.error(`No box exists at ${mid}`);
                    return -1;
                }

                found.classList.add("found_box");

                highlightLine(
                    editor,
                    getStartLine(targetLang, "RETURN_MID"),
                    getEndLine(targetLang, "RETURN_MID")
                );
                await outputAction(outputTerminal, "RETURN_MID", arr, lo, hi, mid, target);
                await resetBoxes(
                    boxes, 
                    0, 
                    n-1, 
                    mid, 
                    delay,
                    stopSignal
                );

                await sleep(delay, stopSignal);
                return mid;
            } 
            
            highlightLine(
                editor,
                getStartLine(targetLang, "ELSEIF"),
                getEndLine(targetLang, "ELSEIF")
            );
            await outputAction(outputTerminal, "ELSEIF", arr, lo, hi, mid, target);
            await sleep(delay, stopSignal);
            //had to change else if to if for highlights and output
            if(val < target){
                highlightLine(
                    editor,
                    getStartLine(targetLang, "UPDATE_LO"),
                    getEndLine(targetLang, "UPDATE_LO")
                );
                await outputAction(outputTerminal, "UPDATE_LO", arr, lo, hi, mid, target);
                await markBoxesInactive(
                    boxes, 
                    lo, 
                    mid, 
                    delay,
                    stopSignal
                );
                lo = mid + 1;
                await sleep(0.75 * delay, stopSignal);
                continue;
            } 
            
            highlightLine(
                editor,
                getStartLine(targetLang, "ELSE"),
                getEndLine(targetLang, "ELSE")
            );
            await outputAction(outputTerminal, "ELSE", arr, lo, hi, mid, target);
            await sleep(delay, stopSignal);
            if(val > target){
                highlightLine(
                    editor,
                    getStartLine(targetLang, "UPDATE_HI"),
                    getEndLine(targetLang, "UPDATE_HI")
                );
                await outputAction(outputTerminal, "UPDATE_HI", arr, lo, hi, mid, target);
                await markBoxesInactive(
                    boxes, 
                    mid, 
                    hi, 
                    delay,
                    stopSignal
                );
                hi = mid - 1;
                await sleep(0.75 * delay, stopSignal);
            }
        }  

        highlightLine(
            editor,
            getStartLine(targetLang, "RETURN_NEG"),
            getEndLine(targetLang, "RETURN_NEG")
        );
        await outputAction(outputTerminal, "RETURN_NEG", arr, n-1, n-1, n-1, target);
        await sleep(delay, stopSignal);
        return -1;
    } catch(error){
        if(error.name === 'AbortError'){
            console.log("Visualisation stopped");
            return -1;
        }
        throw error;
    }
}

function createEditor(editorId, readOnly, language, code){
    return monaco.editor.create(
        document.getElementById(editorId),
        {
            value: code,
            language: language,
            theme: "vs-dark",
            automaticLayout: true,
            minimap: {
                enabled: false
            },
            readOnly: readOnly,
            scrollBeyondLastLine: false,
            fontSize: 16,
            fontFamily: "Consolas, 'Courier new', monospace"
        }
    );
}

async function switchLanguage(editor, idTemplate, language){
    if(!language) return;
    
    const id = idTemplate + language;
    try{
        const text = await getText(id);
        editor.setValue(text);
        monaco.editor.setModelLanguage(editor.getModel(), language);
    } catch(error){
        console.error("switchLanguage: error while switching language");
        console.error(error.message);
    }
}

//const sleep = (s) => new Promise(resolve => setTimeout(resolve, s * 1000));
function sleep(ms, signal){
    return new Promise((resolve, reject) => {
        if(signal?.aborted){
            return reject(new DOMException("Aborted", "AbortError"));
        }
        const timer = setTimeout(resolve, 1000 * ms);
        signal?.addEventListener("abort", () => {
            clearTimeout(timer);
            reject(new DOMException("Aborted", "AbortError"));
        }, {once: true});
    });
}

async function getText(id){
    const text_response = await fetch("/texts.json");
    const texts = await text_response.json();
    const target = texts.find((text) => text.id === id);
    if(!target){
        throw new Error(`getText: no text found with id ${id}`);
    }

    return target.text;
}

function changeVisibility(
    element, on
){
    if(on) element.style.display = "block";
    else element.style.display = "none";
}

function splitInputIntoParts(input){
    if(typeof input !== "string") throw new TypeError("splitInputIntoParts: input was not a string");

    const trimmed = input.trim();
    if(trimmed === "") return [];

    return trimmed.split(/\s+/);
}

//list of warnings displayed when invalid input is detected
const warnings = [
    {
        id: "maxSize",
        message: "* Integers should be at most 3 digits",
        isInvalid: (txt) => {
            const arr = splitInputIntoParts(txt);
            return arr.some((part) => {
                const num = Number(part);
                return Number.isFinite(num) && (num < -999 || num > 999);
            });
        }
    },
    {
        id: "maxCntElements",
        message: "* Array lengths should not exceed 50 elements for the animation",
        isInvalid: (txt) => {
            const arr = splitInputIntoParts(txt);
            return arr.length > 50;
        }
    },
    {
        id: "type",
        message: "* Please do not input floating point numbers, strings, or special characters (&, %, !, ...)",
        isInvalid: (txt) => {
            const arr = splitInputIntoParts(txt);
            return arr.some((part) => {
                const num = Number(part);
                return !Number.isInteger(num);
            });
        }
    },
    {
        id: "missingValues",
        message: "* Please enter an integer",
        isInvalid: (input) => input.trim() === ""
    }
];

function updateWarnings(inputValue, warning_container){
    warning_container.innerHTML = "";
    //if(!inputValue) return;
    const activeWarnings = warnings.filter(condition => condition.isInvalid(inputValue));

    activeWarnings.forEach(condition => {
        const warning = document.createElement("small");
        warning.className = "warning-item";
        warning.textContent = condition.message;
        warning_container.append(warning);
    });
    console.log(`updateWarnings called, ${activeWarnings.length}`)
    return activeWarnings.length;
}

function parseNumberArray(input){
    const arr = splitInputIntoParts(input).filter(part => part !== "");
    return arr.map(part => {
        const num = Number(part);
        if(isNaN(num)){
            throw new TypeError("parseNumberArray: input includes element that is not a number");
        }
        return num;
    }); 
}

function prepareArray(
    array,
    sortArr,
    rmDuplicates
){
    let result = [...array];
    if(sortArr) result.sort((a, b) => a-b);
    if(rmDuplicates) result = removeDuplicates(result);
    return result;
}

function removeDuplicates(input){
    if(!Array.isArray(input)){
        throw new TypeError("removeDuplicates: input was not an array");
    }

    const arr = [];
    const frequency = {};
    for(const num of input){
        if(frequency[num] === undefined){
            frequency[num] = 1;
            arr.push(num);
        } else{
            frequency[num]++;
        }
    }

    return arr;
}

/* displays the content of an array
*/
function displayArray(
    arr, 
    display, 
    sortArr, 
    rmDuplicates
){
    if(!display) throw new TypeError(`displayArray: display is invalid`);
    if(!Array.isArray(arr)) throw new TypeError(`displayArray: array was not a string`);
    if(typeof sortArr !== "boolean") throw new TypeError(`displayArray: sortArr is not a boolean`);
    if(typeof rmDuplicates !== "boolean") throw new TypeError(`displayArray: rmDuplicates is not a boolean`);

    display.replaceChildren();
    const prepared_array = prepareArray(
        arr, 
        sortArr, 
        rmDuplicates
    );

    let size = prepared_array.length;
    if(size > 50){ 
        console.warn(`displayArray: array length exceeded 50 elements`);
        size = 50;
    }

    for(let i = 0; i < size; i++){
        const val = prepared_array[Number(i)];
        if(isNaN(val)) throw new Error("displayArray: input includes an element that is not a number");

        const box = document.createElement("div");
        box.id = `array_simulation_${i}`;
        box.className = "array_value_container_active";
        box.dataset.index = String(i);
        box.dataset.value = String(val);
        box.textContent = String(val);
    
        display.append(box);
    }
}

/*
renders simulation of binary search

TODO:
- description that says smaller integers are best

- calculates height and width of boxed and stops if exceeds 
- runs the actual simulation
- allows for setting of execution delay
- allows for automatic sorting of the array
*/
async function startVisualisation(
    display, 
    arr, 
    target, 
    delay,
    outputTerminal,
    editor,
    language,
    stopController
){    
    const result = await runStandardBinarySearch(
        display,
        arr, 
        target, 
        delay,
        outputTerminal,
        editor,
        language,
        stopController.signal
    );
    console.log("startVisualisation: target was found at ", result);
}

/**Executes the array simulation using the given paremeters
 * 
 * TODO:
 * - guards against starting when there are warnings
 * 
 */
async function tryBtnClick(
    display,
    array,
    target,
    sortArr,
    rmDuplicates,
    setDel,
    delay,
    outputTerminal,
    editor,
    language,
    stopController
){
    console.log("tryBtnClick: tryBtn was clicked");
    try{
        const parsed_array = prepareArray(
            parseNumberArray(array.value),
            sortArr,
            rmDuplicates
        );
        
        const parsed_target = Number(target.value);

        if(sortArr) parsed_array.sort((a, b) => a - b);

        let delayVal = (isNaN(Number(delay))) ? 0 : Number(delay);
        delayVal = (setDel) ? Math.max(0, Number(delay)) : 0;
        console.log(`${setDel} ${delayVal}`);
        await startVisualisation(
            display,
            parsed_array, 
            parsed_target,
            delayVal,
            outputTerminal,
            editor,
            language,
            stopController
        );
    } catch(error){
        console.error("tryBtnClick: error while parsing", error);
    }
}

/**Resets all input fields by the user for the standard binary search simulation
 * 
 */
function resetBtnClick(
    display,
    array,
    target,
    sortArr,
    rmDuplicates,
    setDel,
    delayContainer,
    outputTerminal,
    editor
){
    console.log("resetBtnClick: resetBtn was clicked");
    array.value = "";
    target.value = "";
    sortArr.checked = false;
    rmDuplicates.checked = false;
    setDel.checked = false;
    delayContainer.style.display = "none";
    delayContainer.value = 0.5;
    
    display.replaceChildren();
    outputTerminal.replaceChildren();
    clearHighlights(editor);
}

/* Generates a random array for the standard binary search simulation
 */
function randomBtnClick(
    display,
    array,
    sortArr,
    rmDuplicates
){
    console.log("randomBtnClick: randomBtn was clicked");
    array.value = "";
    const arraySize = Math.floor(Math.random() * 46) + 5;
    for(let i = 0; i < arraySize; i++){
        array.value += Math.floor(Math.random() * 1000) * (Math.random() < 0.5 ? 1 : -1);
        array.value += " ";
    }

    try{
        const parsed_array = parseNumberArray(array.value);

        displayArray(
            parsed_array, 
            display, 
            sortArr,
            rmDuplicates
        );
    } catch(error){
        console.error("randomBtnClick: failed to parse array");
        console.error("randomBtnClick:", error.message);
    }
}

//selfexplanatory
function stopVisualisation(controller){
    if(controller){
        controller.abort();
        controller = null;
    }
}

//used to benchmark user code against large inputs
function generateSortedArray(size){
    const arr = new Array(size);
    for(let i = 0; i < size; i++){
        arr[i] = Math.floor((Math.random() * size));
        arr[i] *= (Math.random() < 0.5 ? -1 : 1);
    }
    arr.sort((a,b) => a - b);
    return arr;
}

/**Tests user's code against a variety of test cases to determine the issue with the code
 * 
 * 
 */
async function submitBtnClick(editor){
    const boilerplate = 
    `
    import json
    import math
    import time
    import traceback

    def testUserCode(user_code, test_cases_json):
        test_cases = json.loads(test_cases_json)
        scope = {} #pls dont change this my application will crash
        try:
            exec(user_code, scope)
        except Exception as error:
            return json.dumps({
                "status": "EXECUTION_ERROR",
                "error": str(error),
                "traceback": traceback.format_exc()
            })

        binary_search = scope.get("binary_search")
        if not callable(binary_search):
            return json.dumps({
                "status": "EXECUTION_ERROR",
                "error": "You didn't define the function",
                "traceback": traceback.format_exc()
            })

        results = []

        for test in test_cases:
            start_time = time.perf_counter()

            arr = test["array"]
            target = test["target"]
            expected = test["expected"]

            user_result = None
            try:
                user_result = binary_search(arr, target)
                result = "AC" if (user_result == expected) else "WA"
            except Exception:
                result = "RE"

            end_time = time.perf_counter()
            runtime_seconds = (end_time - start_time)
            
            results.append({
                "status": result,
                "type": test.get("type", []),
                "expected": expected,
                "got": user_result,
                "time": runtime_seconds
            })

        #now the time complexity
        allowed_ms = 20
        benchmark_results = []
        for test_case in benchmarking_arrays:
            test = test_case.to_py()
            arr = test["array"]
            target = test["target"]

            start_time = time.perf_counter()
            try:
                user_result = binary_search(arr, target)
                runtime_seconds = time.perf_counter() - start_time

                correct = (user_result is not None and 0 <= user_result < len(arr) and arr[user_result] == target)
                runtime_ms = runtime_seconds * 1000
                if not correct:
                    result = "WA"
                elif runtime_ms > allowed_ms:
                    result = "TLE"
                else:
                    result = "AC"

            except Exception:
                result = "RE"
                runtime_seconds = None
            
            benchmark_results.append({
                "size": len(arr),
                "status": result,
                "runtime_ms": round(runtime_seconds * 1000, 3) if runtime_seconds is not None else None
            })    
                
        return json.dumps({
            "status": "works",
            "tests": results,
            "benchmarks": benchmark_results
        })

    testUserCode(user_code, test_cases_json)
    `
    ;
    const panel = document.createElement("div");
    panel.className = "container";
    const user_code = String(editor.getValue());

    const data = await fetch(`/tests.json`);
    const test_cases_json = await data.text();

    pyodide.globals.set("user_code", user_code);
    pyodide.globals.set("test_cases_json", test_cases_json);

    let benchmarking_arrays = [];
    for(let size = 1; size <= 6; size++){
        let true_size = 10;
        for(let i = 1; i <= size; i++) true_size *= 10;
        const arr = generateSortedArray(true_size);
        const target = arr[Math.floor(Math.random() * arr.length)];
        benchmarking_arrays.push({
            "array": arr,
            "target": target
        });
    }
    pyodide.globals.set("benchmarking_arrays", benchmarking_arrays);
    
    const raw_results = JSON.parse(await pyodide.runPythonAsync(boilerplate));
    if(!Array.isArray(raw_results) && raw_results.status === `EXECUTION_ERROR`){
        console.error(`submitBtnClick: syntax or definition error`, raw_results.error);
        return;
    }
    console.log(`All test results`, raw_results);
    
}

async function initExplanationSection(main_panel){
    const explanation_section = document.querySelector("#explanation_section");

    const standard_bs_explanation = document.querySelector("#standard_bs_explanation");
    const standard_bs_explanation_introduction = document.querySelector("#standard_bs_explanation_introduction");
    const standard_bs_explanation_process = document.querySelector("#standard_bs_explanation_process");
    const standard_bs_explanation_usage = document.querySelector("#standard_bs_explanation_usage");

    standard_bs_explanation_introduction.textContent = await getText("standard_bs_explanation_introduction");
    standard_bs_explanation_process.textContent = await getText("standard_bs_explanation_process");
    standard_bs_explanation_usage.textContent = await getText("standard_bs_explanation_usage");

    /*
    TODO:
    - reads input array and searched target from a text field
    - displays the single elements whenever a new element is registered
    - runs binary search
    - outputs and displays the result
    - use MONACO editor 
    */

    const standard_bs_simulation = document.querySelector("#standard_bs_simulation");
    const standard_bs_simulation_input_array = document.querySelector("#array_input_text");
    const standard_bs_simulation_input_array_warnings = document.querySelector("#array_input_warnings");
    const standard_bs_simulation_input_target = document.querySelector("#array_input_target");
    const standard_bs_simulation_input_target_warnings = document.querySelector("#array_input_target_warnings");

    let input_array_warnings = 0, input_target_warnings = 0;

    const standard_bs_simulation_display = document.querySelector("#standard_bs_simulation_display");
    const standard_bs_simulation_tryBtn = document.querySelector("#standard_bs_simulation_tryBtn");
    const standard_bs_simulation_resetBtn = document.querySelector("#standard_bs_simulation_resetBtn");
    const standard_bs_simulation_randomBtn = document.querySelector("#standard_bs_simulation_randomBtn");
    const standard_bs_simulation_stopBtn = document.querySelector("#standard_bs_simulation_stopBtn");

    const standard_bs_simulation_parameters_sort = document.querySelector("#standard_bs_simulation_parameters_sort");
    const standard_bs_simulation_parameters_duplicates = document.querySelector("#standard_bs_simulation_parameters_duplicates");
    const standard_bs_simulation_parameters_delay = document.querySelector("#standard_bs_simulation_parameters_delay");
    const standard_bs_simulation_parameters_delay_input = document.querySelector("#standard_bs_simulation_parameters_delay_input");  

    input_array_warnings = updateWarnings(
        standard_bs_simulation_input_array.value, 
        standard_bs_simulation_input_array_warnings
    );

    input_target_warnings = updateWarnings(
        standard_bs_simulation_input_target.value, 
        standard_bs_simulation_input_target_warnings
    );

    standard_bs_simulation_input_array.addEventListener("input", (element) => {
        input_array_warnings = updateWarnings(
            element.target.value, 
            standard_bs_simulation_input_array_warnings
        );
        try{
            const parsed_array = parseNumberArray(standard_bs_simulation_input_array.value);
            displayArray(
                parsed_array, 
                standard_bs_simulation_display,
                standard_bs_simulation_parameters_sort.checked,
                standard_bs_simulation_parameters_duplicates.checked
            );
            console.log("standard_bs_simulation: displaying array");
        } catch(error){
            console.error("standard_bs_simulation: error while parsing:", error);
        }
    });

    standard_bs_simulation_input_target.addEventListener("input", (element) => {
        input_target_warnings = updateWarnings(
            element.target.value, 
            standard_bs_simulation_input_target_warnings
        );
    });

    standard_bs_simulation_parameters_sort.addEventListener("change", () => {
        console.log("standard_bs_simulation_parameters_sort: sort toggled");
        try{
            const parsed_array = parseNumberArray(standard_bs_simulation_input_array.value);
            
            displayArray(
                parsed_array,
                standard_bs_simulation_display,
                standard_bs_simulation_parameters_sort.checked,
                standard_bs_simulation_parameters_duplicates.checked
            );
        } catch(error){
            console.error("parameters - sort: error while parsing:", error);
        }
    });

    standard_bs_simulation_parameters_duplicates.addEventListener("change", () => {
        console.log("standard_bs_simulation_parameters_duplicates: duplicates toggled");
        try{
            const parsed_array = parseNumberArray(standard_bs_simulation_input_array.value);
            displayArray(
                parsed_array,
                standard_bs_simulation_display,
                standard_bs_simulation_parameters_sort.checked,
                standard_bs_simulation_parameters_duplicates.checked
            );
        } catch(error){
            console.error("parameters - duplicates: error while parsing:", error);
        }
    });

    standard_bs_simulation_parameters_delay.addEventListener("change", (element) => {
        console.log("standard_bs_simulation_parameters_delay: delay toggled");
        if(element.target.checked){
            changeVisibility(standard_bs_simulation_parameters_delay_input, true);
        } else{
            changeVisibility(standard_bs_simulation_parameters_delay_input, false);
        }
    });

    let standard_bs_simulation_running = false;

    const standard_bs_code_language = document.querySelector("#standard_bs_code_language");
    //disableElement(standard_bs_code_language, false);
    //initialize the code with python version
    const standard_bs_code_python = await getText("standard_bs_code_python");
    const standard_bs_code_editor = createEditor(
        "standard_bs_code_editor",
        true,
        "python",
        standard_bs_code_python
    );
    
    standard_bs_code_language.addEventListener("change", (element) => {
        if(!standard_bs_simulation_running){
            switchLanguage(
                standard_bs_code_editor, 
                "standard_bs_code_", 
                element.target.value
            );
        }
    });

    const standard_bs_simulation_output = document.querySelector("#standard_bs_simulation_output");

    let stopAnimationController = null;

    standard_bs_simulation_tryBtn.addEventListener("click", async () => {
        if(input_array_warnings > 0 || input_target_warnings > 0){
            console.warn(`Cannot start simulation. Please consider the warning(s).`);
            return;
        }

        if(standard_bs_simulation_running){
            console.warn(`The simulation is still running. Please wait until it has finished before running it again.`);
            return;
        }

        standard_bs_simulation_running = true;
        stopAnimationController = new AbortController();
        standard_bs_simulation_output.replaceChildren();
        disableElement(standard_bs_code_language, true);
        try{
            await tryBtnClick(
                standard_bs_simulation_display,
                standard_bs_simulation_input_array,
                standard_bs_simulation_input_target,
                standard_bs_simulation_parameters_sort.checked,
                standard_bs_simulation_parameters_duplicates.checked,
                standard_bs_simulation_parameters_delay.checked,
                array_input_delay.value,
                standard_bs_simulation_output,
                standard_bs_code_editor,
                standard_bs_code_language.value,
                stopAnimationController
            );
        } finally{
            standard_bs_simulation_running = false;
            stopVisualisation(stopAnimationController);
            disableElement(standard_bs_code_language, false);
        }

        input_array_warnings = updateWarnings(
            standard_bs_simulation_input_array.value,
            standard_bs_simulation_input_array_warnings
        );
    });

    standard_bs_simulation_resetBtn.addEventListener("click", () => {
        if(standard_bs_simulation_running){
            stopVisualisation(stopAnimationController);
        }

        resetBtnClick(
            standard_bs_simulation_display,
            standard_bs_simulation_input_array,
            standard_bs_simulation_input_target,
            standard_bs_simulation_parameters_sort,
            standard_bs_simulation_parameters_duplicates,
            standard_bs_simulation_parameters_delay,
            standard_bs_simulation_parameters_delay_input,
            standard_bs_simulation_output,
            standard_bs_code_editor
        );
        input_array_warnings = updateWarnings(
            standard_bs_simulation_input_array.value,
            standard_bs_simulation_input_array_warnings
        );
        input_target_warnings = updateWarnings(
            standard_bs_simulation_target_array.value,
            standard_bs_simulation_target_array_warnings
        );
    });

    standard_bs_simulation_randomBtn.addEventListener("click", () => {
        if(standard_bs_simulation_running){
            stopVisualisation(stopAnimationController);
        }

        randomBtnClick(
            standard_bs_simulation_display,
            standard_bs_simulation_input_array,
            standard_bs_simulation_parameters_sort.checked,
            standard_bs_simulation_parameters_duplicates.checked
        );
        input_array_warnings = updateWarnings(
            standard_bs_simulation_input_array.value,
            standard_bs_simulation_input_array_warnings
        );
    });

    standard_bs_simulation_stopBtn.addEventListener("click", () => {
        if(!standard_bs_simulation_running){
            console.warn(`stopBtn: simulation isn't running`);
            return;
        }
        if(standard_bs_simulation_running){
            stopVisualisation(stopAnimationController);
            outputAction(standard_bs_simulation_output, "STOPPED", [], 0, 0, 0, 0);
        }
    });

    explanation_section.append(standard_bs_explanation, standard_bs_simulation);
    main_panel.append(explanation_section);
}

/* Lets user write their own Binary Search function
 * 
 * TODO:
 * - allow user to write code
 * - support Python
 * 
 * - compile / run code
 * - display result
 * - same animation as simulation section
 * - allow for input array or txt file
 * - display result
 * - diagnose likely issue based on several tests
 * - guard against malicious code / security breaches 
 */
async function initTryoutSection(main_panel){
    const tryout_section = document.querySelector("#tryout_section");

    const tryout_template_python = await getText("tryout_template_python");
    const tryout_editor = createEditor(
        "tryout_editor",
        false,
        "python",
        tryout_template_python
    );

    let submission_running = false;
    const tryout_simulation_submitBtn = document.querySelector("#tryout_simulation_submitBtn");
    tryout_simulation_submitBtn.addEventListener("click", async () => {   
        if(submission_running){
            console.warn(`Please wait until the current submission is finished`);
            return;
        }

        try{
            await submitBtnClick(tryout_editor);
        } catch(error){
            console.error(error.message);
        } finally{
            submission_running = false;
        }
    });

    main_panel.append(tryout_section);
}

/**initialises the information section 
 * provides information about related topics
 * 
 */
async function initInformationSection(main_panel){
    const information_section = document.querySelector("#information_section");
    
    const variations = document.querySelector("#variations");
    const variation_introduction_text = document.querySelector("#variation_introduction_text");
    const lower_bound_explanation_text = document.querySelector("#lower_bound_explanation_text");
    const upper_bound_explanation_text = document.querySelector("#upper_bound_explanation_text");
    variation_introduction_text.textContent = await getText("variation_introduction");
    lower_bound_explanation_text.textContent = await getText("lower_bound_explanation");
    upper_bound_explanation_text.textContent = await getText("upper_bound_explanation");

    const practice_problems = document.querySelector("#practice_problems");

    information_section.append(variations, practice_problems);
    main_panel.append(information_section);
}


/** initializes program
 * 
 *  TODO:
 *  - add navigation bar
 *  - add English and German language support
 * 
 */
async function start(){
    //const navigation_bar
    const navigation_bar = document.querySelector("#navigation_bar");
    document.querySelectorAll(".dropdown_btn").forEach((button) => {
        button.addEventListener("click", () => {
            const container = button.nextElementSibling;
            container.classList.toggle("show");
        });
    });


    const main_panel = document.createElement("div");
    await initExplanationSection(main_panel);
    await initTryoutSection(main_panel);
    await initInformationSection(main_panel);

    document.body.append(main_panel);
};

start();