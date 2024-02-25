const fs = require('fs');
const path = require('path');

/**
 * @typedef {Object} FeatherFunctionParameter
 * @property {string} name
 * @property {string} type
 * @property {string} description
 * @property {boolean} is_optional
 */
/**
 * @typedef {Object} FeatherFunction
 * @property {string} name
 * @property {string} description
 * @property {boolean} is_deprecated
 * @property {boolean} is_pure
 * @property {FeatherFunctionParameter[]} params
 */
/**
 * @typedef {Object} FeatherVariable
 * @property {string} name
 * @property {string} type
 * @property {string} description
 * @property {boolean} is_deprecated
 * @property {boolean} can_read
 * @property {boolean} can_write
 * @property {boolean} [is_instance_variable]
 */
/**
 * @typedef {Object} FeatherConstant
 * @property {string} name
 * @property {string} type
 * @property {string} description
 * @property {boolean} is_deprecated
 */
/** 
 * @typedef {Object} FeatherStruct
 * @property {string} name
 * @property {FeatherVariable[]} fields
 */
/**
 * @typedef {Object} FeatherEnumMember
 * @property {string} name
 * @property {number} value
 * @property {boolean} is_deprecated
 * @property {string} description
 */
/**
 * @typedef {Object} FeatherEnum
 * @property {string} name
 * @property {FeatherEnumMember[]} members
 */
/**
 * @typedef {Object} FeatherDocumentation
 * @property {{[v: string]: FeatherFunction}} functions
 * @property {{[v: string]: FeatherVariable}} variables
 * @property {{[v: string]: FeatherConstant}} constants
 * @property {{[v: string]: FeatherStruct}} structures
 * @property {{[v: string]: FeatherEnum}} enumerations
 */
(function() {
    /** @type {FeatherDocumentation} */
    const feather_docs = {
        functions: {},
        variables: {},
        constants: {},
        structures: {},
        enumerations: {},
    }
    const mouse = {
        x: -1,
        y: -1,
    }
    GMEdit.register("feather-hints", {
        init: function() {
            
            // find the latest runtime
            const runtimes = [];
            // try regular path

            const windows_paths = [
                'C:\\ProgramData\\GameMaker\\Cache\\runtimes\\',
                'C:\\ProgramData\\GameMakerStudio2\\Cache\\runtimes'
            ]
            for (const dir of windows_paths) {
                try {
                    console.log(fs.statSync(dir));
                } catch(e) {
                    //console.log(e);
                    continue;
                }
                const dirs = fs.readdirSync(dir).sort().map(v=>path.join(dir,v));
                runtimes.push(...dirs)
            }

            console.log(runtimes);

            const parser = new DOMParser();

            const target_file = path.join(runtimes[0],'GmlSpec.xml');

            const gml_spec_file = fs.readFileSync(target_file,'utf8');

            const xml = parser.parseFromString(gml_spec_file,"text/xml");
            
            //window.__xml = xml;
            //console.log(xml);

            // and now to parse the XML

            const tags = {
                functions: [...xml.getElementsByTagName("Function")],
                variables: [...xml.getElementsByTagName("Variable")],
                constants: [...xml.getElementsByTagName("Constant")],
                structures: [...xml.getElementsByTagName("Structure")],
                enumerations: [...xml.getElementsByTagName("Enumeration")],
            }


            feather_docs.functions = to_map(tags.functions.map(v=>parse_function_tag(v)));
            feather_docs.variables = to_map(tags.variables.map(v=>parse_variable_tag(v)));
            feather_docs.constants = to_map(tags.constants.map(v=>parse_constant_tag(v)));
            feather_docs.structures = to_map(tags.structures.map(v=>parse_structure_tag(v)));
            feather_docs.enumerations = to_map(tags.enumerations.map(v=>parse_enumeration_tag(v)));
            
            //window.__feather_docs = feather_docs;

            const original_settext = aceEditor.tooltipManager.ttip.setText;

            aceEditor.tooltipManager.ttip.setText = function(...params) {
                const pos = aceEditor.renderer.screenToTextCoordinates(mouse.x,mouse.y);
                const token = aceEditor.session.getTokenAt(pos.row,pos.column);
                const key = token.value;

                if (feather_docs.functions[key]) {
                    console.log(feather_docs.functions[key])
                }
                const tooltip = build_tooltip(key);
                if (tooltip.trim() != '') {
                    aceEditor.tooltipManager.ttip.setHtml.apply(this,[tooltip])
                } else {
                    original_settext.apply(this, params)
                }
            }
        }
    });
    function to_map(list){
        const out = {};
        for (item of list) {
            out[item.name] = item;
        }
        return out;
    }
    function parse_function_tag(fn) {
        const name = fn.getAttribute('Name');
        const is_deprecated = fn.getAttribute('Deprecated') == "true" ? true : false;
        const return_type = fn.getAttribute('ReturnType');
        const is_pure = fn.getAttribute('Pure') == "true" ? true : false;
    
        const desc = fn.getElementsByTagName('Description')[0];
        const description = desc ? (desc.textContent || '') : '';
        const params = [];
        const param_tags = fn.getElementsByTagName('Parameter');
        for (const tag of param_tags) {
            params.push({
                name: tag.getAttribute('Name'),
                type: tag.getAttribute('Type'),
                is_optional: tag.getAttribute('Optional') == 'true',
                description: tag.textContent || '',
            });
        }

        return {
            name,
            is_deprecated,
            return_type,
            is_pure,
            description,
            params
        }
    }
    function parse_variable_tag(vr) {
        const name = vr.getAttribute('Name');
        const type = vr.getAttribute('Type');
        const is_deprecated = vr.getAttribute('Deprecated') == 'true';
        const can_read = vr.getAttribute('Get') == 'true';
        const can_write = vr.getAttribute('Set') == 'true';
        const is_instance_variable = vr.getAttribute('Instance') == 'true';
        const description = vr.textContent || '';
        return {
            name,
            type,
            is_deprecated,
            can_read,
            can_write,
            is_instance_variable,
            description,
        }
    }
    function parse_constant_tag(cn) {
        const name = cn.getAttribute('Name');
        const type = cn.getAttribute('Type');
        const is_deprecated = cn.getAttribute('Deprecated') == 'true';
        const description = cn.textContent || '';
    
        return {
            name,
            type,
            is_deprecated,
            description
        }
    }
    function parse_structure_tag(st) {
        const name = st.getAttribute("Name");
        const fields = [];
        const field_tags = st.getElementsByTagName("Field")
        for (const tag of field_tags) {
            fields.push(parse_variable_tag(tag));
        }
        return {
            name, fields
        }
    }
    function parse_enumeration_tag(en) {
        const name = en.getAttribute('Name');
        const members = [];
    
        const member_tags = en.getElementsByTagName('Member')
        for (const tag of member_tags) {
            members.push({
                name: tag.getAttribute('Name'),
                value: parseInt(tag.getAttribute('Value')),
                is_deprecated: tag.getAttribute('Deprecated') == 'false',
                description: tag.textContent || '',
            });
        }
        return {name,members};
    }
    function build_tooltip(key) {
        let found = true;
        let tooltip = '';
        tooltip += `<div class="sid-custom-tooltip">\n`
        if (feather_docs.functions[key]) {
            // it's a function
            const fn = feather_docs.functions[key];
            tooltip += `<span class="ace_keyword"> function </span> <span class="ace_function"> ${fn.name} </span>`;
            tooltip += `(${fn.params.map(v=>`${v.is_optional ? '[' : ''}${v.name}: ${v.type}${v.is_optional ? ']' : ''}`)})`;
            tooltip += `<hr/>`;
            tooltip += `${fn.description}`;
            if (fn.params.length > 0) {
                tooltip += `<hr/>`;
                tooltip += `<table>`
                tooltip += fn.params.map(v=>`<tr><td>${v.name}</td><td>${v.is_optional ? '@optional ' : ''} ${v.description}</td></tr>`).join('\n')
                tooltip += '</table>'
            }
        } else if (feather_docs.variables[key]) {
            // it's a variable
            const vr = feather_docs.variables[key];
            tooltip += `<span class="ace_variable">${vr.name}</span>: ${vr.type}`;
            if (vr.description) {
                tooltip += '<hr/>';
                tooltip += `${vr.description}`;
            }
        } else if (feather_docs.constants[key]) {
            // it's a constant
            const cn = feather_docs.constants[key];
            tooltip += `<span class="ace_constant">${cn.name}</span>: ${cn.type}`;
            if (cn.description) {
                tooltip += "<hr/>";
                tooltip += `${cn.description}`;
            }
        } else if (feather_docs.structures[key]) {
            // it's a struct
            const st = feather_docs.structures[key];
            tooltip += `<span class="ace_constant">${st.name}</span>`;
        } else if (feather_docs.enumerations[key]) {
            // it's an enum
            const en = feather_docs.enumerations[key];
            tooltip += `<span class="ace_enumfield">${en.name}</span>`;
        } else {
            found = false;
        }

        tooltip += `\n</div>`


        return found ? tooltip : '';
    }
    window.addEventListener('mousemove',(evt)=>{
        mouse.x = evt.clientX;
        mouse.y = evt.clientY;
    })
})();