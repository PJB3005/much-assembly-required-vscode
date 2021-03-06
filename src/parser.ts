/*
THIS FILE IS A MODIFIED VERSION OF https://github.com/simon987/Much-Assembly-Required-Frontend/blob/master/mar/editor.js
If you want to update this, I pretty much just:
1. Copy pasted it
2. Exported parse(), made it return and use a parameter instead of connecting to ace directly.
3. Removed the ace-stuff.
4. Added const in front of these 5 lines just below this comment.
5. Profit!
*/

const OPERAND_INVALID = -1;
const OPERAND_REG = 0;
const OPERAND_MEM_IMM = 1;
const OPERAND_MEM_REG = 2;
const OPERAND_IMM = 3;

function removeComment(line) {
    if (line.indexOf(";") !== -1) {

        return line.substring(0, line.indexOf(";"));

    } else {
        return line;
    }
}

function checkForLabel(line, result) {
    line = removeComment(line);

    var match;
    if ((match = /\b\w*\b:/.exec(line)) !== null) {

        result.labels.push(match[0].substring(0, match[0].length - 1));
    }
}

function checkForSegmentDeclaration(line) {

    var tokens = getTokens(line);

    return tokens[0] !== undefined && (tokens[0].toLowerCase() === ".data" || tokens[0].toLowerCase() === ".text");

}

function checkForEQUInstruction(line, result, currentLine) {

    var tokens = getTokens(line);


    if (line.toLowerCase().indexOf(" equ ") !== -1 || tokens[1] !== undefined && tokens[1].toLowerCase() === "equ") {
        //Save as a label
        var num = Number(tokens[2]);
        if (!isNaN(num) && num === Math.floor(num)) {
            result.labels.push(tokens[0]);
            return true;
        } else {
            result.annotations.push({
                row: currentLine,
                column: 0,
                text: "Usage: constant_name EQU immediate_value",
                type: "error"
            });
            return true;
        }
    } else {
        return false;
    }
}

function getTokens(line) {

    var tokens = line.split(/\s+/);

    for (var i = 0; i < tokens.length; i++) {
        if (tokens[i] === "") {
            tokens.splice(i, 1);
        }
    }

    return tokens;
}

function removeLabel(line) {
    return line.replace(/\b\w*\b:/, "");
}

function checkForORGInstruction(line, result, currentLine) {
    line = removeComment(line);
    line = removeLabel(line);

    //Split string
    var tokens = getTokens(line);
    var mnemonic = tokens[0];

    if (mnemonic !== undefined && mnemonic.toLowerCase() === "org") {

        console.log(tokens);

        if (tokens.length > 1) {

            var num = Number(tokens[1]);
            if (!isNaN(num) && num === Math.floor(num)) {
                return true;
            } else {
                result.annotations.push({
                    row: currentLine,
                    column: 0,
                    text: "Invalid operand: " + tokens[1],
                    type: "error"
                });
                return true
            }
        }
    } else {
        return false;
    }
}

function parseDWInstruction(line, result, currentLine) {
    line = line.trim();


    if (line.substr(0, 2).toLowerCase() === "dw") {


        var values = line.substr(2, line.length).split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/, -1);


        for (var i = 0; i < values.length; i++) {

            values[i] = values[i].trim();
            var tokens = getTokens(values[i]);

            if (tokens.length === 2 && getOperandType(tokens[0], result) === OPERAND_IMM &&
                tokens[1].toLowerCase().startsWith("dup(") && tokens[1].endsWith(")") &&
                getOperandType(tokens[1].substring(4, tokens[1].indexOf(")")), result) === OPERAND_IMM) {

                // console.log("DUp");

            } else if (values[i].startsWith("\"") && values[i].endsWith("\"")) {
                //Handle string

            } else if (getOperandType(values[i], result) === OPERAND_IMM) {

                // console.log("is Imm " + values[i]);

            } else {

                result.annotations.push({
                    row: currentLine,
                    column: 0,
                    text: "Usage: DW IMM, IMM ...",
                    type: "error"
                });
                return true;

            }
        }

        return true;
    } else {
        return false;
    }
}


function getOperandType(text, result) {

    text = text.trim();
    if (text === "") {
        return OPERAND_INVALID;
    }

    //Check IMM
    if (!isNaN(Number(text)) && Number(text) === Math.floor(Number(text)) && text.indexOf("o") === -1
        && text.indexOf("e") === -1) {
        return OPERAND_IMM;
    }

    //Check REG
    if (new RegExp('^(a|b|c|d|x|y|bp|sp)$').test(text.toLowerCase())) {
        return OPERAND_REG;
    }

    //Check Label
    for (i = 0; i < result.labels.length; i++) {
        if (text === result.labels[i]) {
            return OPERAND_IMM;
        }
    }

    //Check MEM_*
    if (text.startsWith("[") && text.endsWith("]")) {
        text = text.replace("[", "").replace("]", "");

        //Check MEM_IMM
        if (!isNaN(Number(text)) && Number(text) === Math.floor(Number(text))) {
            return OPERAND_MEM_IMM;
        }
        //Check MEM_Label
        for (var i = 0; i < result.labels.length; i++) {
            if (text === result.labels[i]) {
                return OPERAND_MEM_IMM;
            }
        }

        //Check for MEM_REG (+ x)
        var expr = "";
        if (new RegExp('^(bp|sp)$').test(text.toLowerCase().substring(0, 2).toLowerCase())) {
            //Starts with 2-char register
            expr = text.substring(2);
        } else if (new RegExp('^(a|b|c|d|x|y)$').test(text.toLowerCase().substring(0, 1).toLowerCase())) {
            //Starts with 1-char register
            expr = text.substring(1);
        } else {
            return OPERAND_INVALID;
        }


        if (expr.replace(/\s+/g, '') === "") {
            //No displacement specified
            return OPERAND_MEM_REG;
        }

        //Remove white space
        expr = expr.replace(/\s+/g, '');
        //expr should now look like this: '+1' '-3' '+0x02' '+myLabel'

        //Check for label
        for (i = 0; i < result.labels.length; i++) {
            if (expr.substring(1) === result.labels[i]) {
                return OPERAND_MEM_REG;
            }
        }
        //Check for number
        if (!isNaN(Number(expr)) && Number(expr) === Math.floor(Number(expr))) {
            return OPERAND_MEM_REG;
        }

    }

    return OPERAND_INVALID;

}

function parseInstruction(line, result, currentLine) {
    line = removeComment(line);
    line = removeLabel(line);

    var tokens = getTokens(line);
    var mnemonic = tokens[0];

    if (mnemonic === undefined || mnemonic === "") {
        return; //Line is empty
    }


    if (!parseDWInstruction(line, result, currentLine)) {

        if (new RegExp('\\b(?:mov|add|sub|and|or|test|cmp|shl|shr|mul|push|pop|div|xor|hwi|hwq|nop|neg|' +
                'call|ret|jmp|jnz|jg|jl|jge|jle|int|jz|js|jns|brk|not|jc|jnc|ror|rol|sal|sar|jo|jno|inc|dec)\\b').test(mnemonic.toLowerCase())) {


            if (line.indexOf(",") !== -1) {
                //2 Operands
                var strO1 = line.substring(line.indexOf(mnemonic) + mnemonic.length, line.indexOf(','));
                var strO2 = line.substring(line.indexOf(',') + 1).trim();


                //Validate operand number
                if (!new RegExp('\\b(?:mov|add|sub|and|or|test|cmp|shl|shr|xor|rol|ror|sal|sar)\\b').test(mnemonic.toLowerCase())) {
                    result.annotations.push({
                        row: currentLine,
                        column: 0,
                        text: mnemonic + " instruction with 2 operands is illegal",
                        type: "error"
                    });
                    return;
                }

                //Validate operand type
                var o1Type = getOperandType(strO1, result);
                var o2Type = getOperandType(strO2, result);
                if (o1Type === OPERAND_INVALID) {
                    result.annotations.push({
                        row: currentLine,
                        column: 0,
                        text: "Invalid operand: " + strO1,
                        type: "error"
                    });
                    return;
                }
                if (o2Type === OPERAND_INVALID) {
                    result.annotations.push({
                        row: currentLine,
                        column: 0,
                        text: "Invalid operand: " + strO2,
                        type: "error"
                    });
                    return;
                }

                //Check for illegal operand combos:
                if (o1Type === OPERAND_IMM) {
                    result.annotations.push({
                        row: currentLine,
                        column: 0,
                        text: "Destination operand can't be an immediate value",
                        type: "error"
                    });
                }


            } else if (tokens.length > 1) {
                //1 Operand
                strO1 = line.substring(line.indexOf(mnemonic) + mnemonic.length).trim();

                //Validate operand number
                if (!new RegExp('\\b(?:push|mul|pop|div|neg|call|jnz|jg|jl|jge|jle|hwi|hwq|jz|js|jns|ret|jmp|not|jc|jnc|jo|jno|inc|dec)\\b').test(mnemonic.toLowerCase())) {
                    result.annotations.push({
                        row: currentLine,
                        column: 0,
                        text: mnemonic + " instruction with 1 operand is illegal",
                        type: "error"
                    });
                    return;
                }

                //Validate operand type
                if (getOperandType(strO1, result) === OPERAND_INVALID) {
                    result.annotations.push({
                        row: currentLine,
                        column: 0,
                        text: "Invalid operand: " + strO1,
                        type: "error"
                    });
                }


            } else {
                //No operand
                if (!new RegExp('\\b(?:ret|brk|nop)\\b').test(mnemonic.toLowerCase())) {

                    //Validate operand number
                    result.annotations.push({
                        row: currentLine,
                        column: 0,
                        text: mnemonic + " instruction with no operand is illegal",
                        type: "error"
                    });
                }
            }


        } else {
            result.annotations.push({
                row: currentLine,
                column: 0,
                text: "Unknown mnemonic: " + mnemonic,
                type: "error"
            });
        }

    }
}

export default function parse(text: string) {
    var lines = text.split("\n");
    var result = {
        labels: [],
        annotations: []
    };

    //Pass 1 of 2: Save label names
    for (var currentLine = 0; currentLine < lines.length; currentLine++) {
        checkForLabel(lines[currentLine], result);
    }


    //Pass 2 of 2: Check instructions
    for (currentLine = 0; currentLine < lines.length; currentLine++) {

        if (!checkForSegmentDeclaration(lines[currentLine]) &&
            !checkForEQUInstruction(lines[currentLine], result, currentLine) &&
            !checkForORGInstruction(lines[currentLine], result, currentLine)) {

            parseInstruction(lines[currentLine], result, currentLine);
        }

    }

    return result.annotations;
}
