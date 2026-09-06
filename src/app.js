import * as monaco from "monaco-editor";
import "./style.css";

import editorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import jsonWorker from "monaco-editor/esm/vs/language/json/json.worker?worker";
import cssWorker from "monaco-editor/esm/vs/language/css/css.worker?worker";
import htmlWorker from "monaco-editor/esm/vs/language/html/html.worker?worker";
import tsWorker from "monaco-editor/esm/vs/language/typescript/ts.worker?worker";

import { loadPyodide } from "pyodide";
const pyodide = await loadPyodide({
    indexURL: "/pyodide/"
});

//console.log(pyodide.runPython("67"));

self.MonacoEnvironment = {
  getWorker(_, label) {
    if (label === "json") {
      return new jsonWorker();
    }

    if (label === "css" || label === "scss" || label === "less") {
      return new cssWorker();
    }

    if (label === "html" || label === "handlebars" || label === "razor") {
      return new htmlWorker();
    }

    if (label === "typescript" || label === "javascript") {
      return new tsWorker();
    }

    return new editorWorker();
  }
};

/**NOTE:
 * This is the absolute worst code that any human has written
 * I have no idea what I was thinking while designing this madness or whether I was thinking at all
 * Please do not touch anything or try to maintain this - it works
 * Hours wasted here: 17
 */

/*
TODO:
- runs standard binary search on the array for the target
- synchronizes with an animation
*/
async function resetBoxes(
    boxes,
    left,
    right,
    mid,
    delay
){
    for(let i = left; i <= right; i++){
        if(i === mid) continue;
        await sleep(delay * 0.25); 
        const box = boxes[i];
        if(!box) continue;
        box.classList.remove("active_box");
        box.classList.remove("inactive_box");
    };
}

/**
 * TODO:
 * - fix bug with undefined classLists when duplicates are removed
 */
async function markBoxesInactive(
    boxes,
    left,
    right,
    delay
){
    for(let i = left; i <= right; i++){
        await sleep(delay * 0.1); 
        const box = boxes[i];
        if(!box) continue;
        box.classList.remove("active_box");
        box.classList.add("inactive_box");
    };
}

async function runStandardBinarySearch(
    display,
    arr, 
    target,
    delay
    ){
    if(!Array.isArray(arr)) throw new TypeError("runStandardBinarySearch: input was not an array");
    if(!Number.isInteger(Number(target))) throw new TypeError("runStandardBinarySearch: target was not an integer");
    if(isNaN(Number(delay)))  throw new TypeError("runStandardBinarySearch: delay was not a number");
    
    const boxes = Array.from(
        document.querySelectorAll(".array_value_container_active:not(.removed_box)")
    );

    if(boxes.length !== arr.length){
        console.error(`The lengths of boxes and the array does not match ${boxes.length}, ${arr.length}`);
    }

    boxes.forEach((box) => {
        box.classList.remove(
            "found_box",
            "active_box",
            "inactive_box"
        );
        box.classList.add("active_box");
    });

    target = Number(target);

    const n = arr.length;
    let lo = 0, hi = n-1;

    await sleep(delay);
    while(lo <= hi){
        let mid = Math.floor((lo + hi) / 2);
        const val = Number(arr[mid]);
        await sleep(delay);

        if(val === target){
            const found = boxes[mid];
            if(!found){ 
                console.error(`No box exists at ${mid}`);
                return -1;
            }

            found.classList.add("found_box");

            await resetBoxes(
                boxes, 
                0, 
                n-1, 
                mid, 
                delay
            );

            await sleep(delay);
            return mid;
        } else if(val < target){
            await markBoxesInactive(
                boxes, 
                0, 
                mid, 
                delay
            );

            lo = mid + 1;
            await sleep(delay);
        } else{
            await markBoxesInactive(
                boxes, 
                mid, 
                hi, 
                delay
            );

            hi = mid - 1;
            await sleep(delay);
        }
        await sleep(delay);
    }  

    return -1;
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

const sleep = (s) => new Promise(resolve => setTimeout(resolve, s * 1000));

async function getText(id){
    const text_response = await fetch("/texts.json");
    const texts = await text_response.json();
    const target = texts.find((text) => text.id === id);
    if(!target){
        throw new Error(`getText: no text found with id ${id}`);
    }

    return target.text;
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

    for(let i = 0; i < arr.length; i++){
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
async function renderArraySimulation(
    display, 
    arr, 
    target, 
    delay
){    
    const result = await runStandardBinarySearch(
        display,
        arr, 
        target, 
        delay
    );
    console.log("renderArraySimulation: target was found at ", result);
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
    delay
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

        /**
         * TODO:
         * - fix NaN with delay
         */
        let delayVal = (setDel) ? Math.max(0, Number(delay)) : 0;
        console.log(`${setDel} ${delayVal}`);
        await renderArraySimulation(
            display,
            parsed_array, 
            parsed_target,
            delayVal
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
    delayContainer
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

    const standard_bs_simulation_display = document.querySelector("#standard_bs_simulation_display");
    const standard_bs_simulation_tryBtn = document.querySelector("#standard_bs_simulation_tryBtn");
    const standard_bs_simulation_resetBtn = document.querySelector("#standard_bs_simulation_resetBtn");
    const standard_bs_simulation_randomBtn = document.querySelector("#standard_bs_simulation_randomBtn");

    const standard_bs_simulation_parameters_sort = document.querySelector("#standard_bs_simulation_parameters_sort");
    const standard_bs_simulation_parameters_duplicates = document.querySelector("#standard_bs_simulation_parameters_duplicates");
    const standard_bs_simulation_parameters_delay = document.querySelector("#standard_bs_simulation_parameters_delay");
    const standard_bs_simulation_parameters_delay_input = document.querySelector("#standard_bs_simulation_parameters_delay_input");  

    updateWarnings(
        standard_bs_simulation_input_array.value, 
        standard_bs_simulation_input_array_warnings
    );

    updateWarnings(
        standard_bs_simulation_input_target.value, 
        standard_bs_simulation_input_target_warnings
    );

    standard_bs_simulation_input_array.addEventListener("input", (element) => {
        updateWarnings(
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
        updateWarnings(
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

    /**TODO:
     * implement helper function to toggle visibility of an element
     */
    standard_bs_simulation_parameters_delay.addEventListener("change", (element) => {
        console.log("standard_bs_simulation_parameters_delay: delay toggled");
        if(element.target.checked){
            standard_bs_simulation_parameters_delay_input.style.display = "block";
        } else{
            standard_bs_simulation_parameters_delay_input.style.display = "none";
        }
    });

    let standard_bs_simulation_running = false;
    standard_bs_simulation_tryBtn.addEventListener("click", async () => {
        if(standard_bs_simulation_running){
            return;
        }

        standard_bs_simulation_running = true;

        try{
            tryBtnClick(
                standard_bs_simulation_display,
                standard_bs_simulation_input_array,
                standard_bs_simulation_input_target,
                standard_bs_simulation_parameters_sort.checked,
                standard_bs_simulation_parameters_duplicates.checked,
                standard_bs_simulation_parameters_delay.checked,
                standard_bs_simulation_parameters_delay_input.value
            );
        } finally{
            standard_bs_simulation_running = false;
        }

        updateWarnings(
            standard_bs_simulation_input_array.value,
            standard_bs_simulation_input_array_warnings
        );
    });

    standard_bs_simulation_resetBtn.addEventListener("click", () => {
        resetBtnClick(
            standard_bs_simulation_display,
            standard_bs_simulation_input_array,
            standard_bs_simulation_input_target,
            standard_bs_simulation_parameters_sort,
            standard_bs_simulation_parameters_duplicates,
            standard_bs_simulation_parameters_delay,
            standard_bs_simulation_parameters_delay_input,
        );
        updateWarnings(
            standard_bs_simulation_input_array.value,
            standard_bs_simulation_input_array_warnings
        );
    });

    standard_bs_simulation_randomBtn.addEventListener("click", () => {
        randomBtnClick(
            standard_bs_simulation_display,
            standard_bs_simulation_input_array,
            standard_bs_simulation_parameters_sort.checked,
            standard_bs_simulation_parameters_duplicates.checked
        );
        updateWarnings(
            standard_bs_simulation_input_array.value,
            standard_bs_simulation_input_array_warnings
        );
    });
    /*
    TODO: 
    add a section with a visualisation for an inputted array and the value searched for
    upon clicking run_button update placeholder array and animation 
    - only grows up to 50 elements
    - a single element cannot exceed 3 digits or 999 / -999
    - dont start simulation when there are errors

    animation updates according to chosen speed
    the current line of the code lights up 
    eliminated elements turn grey
    other elements stay white-blue ish
    when a valid element is found it turns green

    const standard_bs_visualisation = document.createElement("div");

    */

    const standard_bs_code_language = document.querySelector("#standard_bs_code_language");
    //initialize the code that startr with python version
    const standard_bs_code_python = await getText("standard_bs_code_python");
    const standard_bs_code_display = createEditor(
        "standard_bs_code_display",
        true,
        "python",
        standard_bs_code_python
    );
    
    standard_bs_code_language.addEventListener("change", (element) => {
        switchLanguage(standard_bs_code_display, "standard_bs_code_", element.target.value);
    });


    explanation_section.append(standard_bs_explanation, standard_bs_simulation);
    main_panel.append(explanation_section);
}

/* Lets user write their own Binary Search function
 * 
 * TODO:
 * - allow user to write code
 * - support JS, Python, C++
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
    
    const tryout_editor_language = document.querySelector("#tryout_editor_language");
    const tryout_template_python = await getText("tryout_template_python");
    const tryout_editor = createEditor(
        "tryout_editor",
        false,
        "python",
        tryout_template_python
    );

    tryout_editor_language.addEventListener("change", (element) => {
        switchLanguage(tryout_editor, "tryout_template_", element.target.value);
    });
    /*
    TODO:
    - let user input array
    - let user write binary search function in Python
    - reads and parses code
    - 
    */

    main_panel.append(tryout_section);
}

/** provides information about related topics
 * 
 *  TODO:
 *  - section about lower/upper bound
 *  - section with links to practice problems
 */
async function initInformationSection(main_panel){
    const information_section = document.querySelector("#information_section");

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