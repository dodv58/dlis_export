const fs = require('fs');
const encoder = require('./Encoder.js');
const REP_CODE = encoder.REP_CODE;
const TEMPLATE = require("./Template.js");
const config = require('./common.js');
const byline = require('byline');
let s3;

const COMPONENT_ROLE = {
    ABSATR: 0,
    ATTRIB: 1,
    INVATR: 2,
    OBJECT: 3,
    RDSET: 5,
    RSET: 6,
    SET: 7
};
const VR_MAX_LEN = 32768;
const BUFF_SIZE = 33000;
const NULL_VALUE = -9999
const EFLR = {
    "FILE-HEADER": 0,
    "ORIGIN": 1,
    "CHANNEL": 3,
    "FRAME": 4,
    "PARAMETER": 5
}

function fillStrWithSpace(str, len, mode){
    //mode = 1: fill space after text
    //mode = 0: fill space before text
    if(typeof str != 'string') str = str.toString();
    if(str.length >= len){
        str = str.substring(0, len);
    }
    else {
        const x = len - str.length;
        const spaces = new Array(x+1).join(' ');
        if(mode){
            str = str + spaces;
        }
        else{
            str = spaces + str;
        }
    }
    return str;
}

function customSplit(str, delimiter){
    let words;
    if(str.includes('"')){
        str = str.replace(/"(.*?)"/g, function (match, idx, string){
            let tmp = match.replace(/"/g, '');
            return '"' + Buffer.from(tmp).toString('base64') + '"';
        })
        words = str.split(delimiter);
        words = words.map(function(word){
            if(word.includes('"')){
                return Buffer.from(word.replace(/"/g, ''), 'base64').toString();
            }
            else return word;
        })
    }else {
        words = str.split(delimiter);
    }
    return words;
}

async function dlisExport(wells, exportPath, curveData){
    try{
        if(!exportPath){
            exportPath = "./export.dlis";
        }
        if(fs.existsSync(exportPath)){
            fs.unlinkSync(exportPath);
        }
        const buffer = {
            buffs: [],
            writeIdx: 0,
            bufferIdx: 0,
            writableIdx: -1,
            buffSize: BUFF_SIZE,
            buffCount: 4,
            vrRemain: VR_MAX_LEN
        }
        for(let i = 0; i < buffer.buffCount; i++){
            buffer.buffs.push(Buffer.alloc(buffer.buffSize, 0));
        }
        let vrStartIdx = 0; //index of the first byte of current vr in buff
        let lrsStartIdx = 0; //infex of the first byte of current lrs in buff
        let vrLen = 0; //length of current vr 
        let lrsLen = 0; //length of current lrs 
        let lrsIdx = 0; //index of current lrs
        let lrsType = 0; // current lrs type

        //write SUL
        buffer.buffs[buffer.bufferIdx].write('   1');
        buffer.buffs[buffer.bufferIdx].write('V1.00', 4);
        buffer.buffs[buffer.bufferIdx].write('RECORD', 9);
        buffer.buffs[buffer.bufferIdx].write('32768', 15);
        const ssi =  fillStrWithSpace('ssi Default Storage Set', 60, 1);
        buffer.buffs[buffer.bufferIdx].write(ssi, 20);
        buffer.writeIdx = 80;

        const cTime = new Date();
        const cTimeObj = {y:cTime.getUTCFullYear(), tz:2, m:cTime.getUTCMonth() + 1, d:cTime.getUTCDate(), h:cTime.getUTCHours(), mn:cTime.getUTCMinutes(), s:cTime.getUTCSeconds(), ms:cTime.getUTCMilliseconds()};
        let origin = 0;
        let logicalFile = 0;

        for(const well of wells){
            logicalFile++;
            origin++;
            let FILE_ID = fillStrWithSpace("I2G-"+ well.name, 65, 1);

            //write FHLR
            const fhlr = {
                type: "FILE-HEADER",
                template: [{label: "SEQUENCE-NUMBER", repcode: REP_CODE.ASCII}, {label: "ID", repcode: REP_CODE.ASCII}],
                objects: [{origin: origin, copy_number: 0, name: "1", attribs: [[fillStrWithSpace(logicalFile, 10, 0)], []]}]
            }
            encodeSet(fhlr);

            //write origin
            const olr = {
                name: well.name,
                type: "ORIGIN",
                template: TEMPLATE.OLR,
                objects: [{
                    origin: 1,
                    copy_number: 0,
                    name: well.name,
                    attribs: [[FILE_ID], ["I2G"], [1], [1], ["I2G"], ["I2G"], ["I2G-2019"], ["I2G-Export"],
                        [cTimeObj], ["1"], [], [], ["I2G-" + well.name], [well.name], [], [], [], ["I2G"], [], []]
                }]
            }
            encodeSet(olr);

            let channels = []
            const frames = []
            const parameters = [];
            //write parameter
            for(const param of well.well_headers){
                if(param.value.length > 0){
                    parameters.push({
                        origin: origin,
                        copy_number: 0,
                        name: param.header,
                        attribs: [[param.description], [1], [], [], [param.value]]
                    });
                }
            }
            const parameterSet = {
                type: "PARAMETER",
                template: TEMPLATE.PARAMETER,
                objects: parameters
            }
            //console.log(JSON.stringify(parameterSet));
            encodeSet(parameterSet);

            for(const dataset of well.datasets){
                origin += 1;
                dataset.origin = origin;
                const curves = [];
                curves.push({
                    origin: origin,
                    copy_number: 0,
                    name: "TDEP",
                    attribs: [[], [], [REP_CODE.FDOUBL], [dataset.unit],
                        [1], [], [], []]
                })
                for(const curve of dataset.curves){
                    curves.push({
                        origin: origin,
                        copy_number: 0,
                        name: curve.name,
                        attribs: [[curve.description], [], [curve.type == "TEXT"? REP_CODE.ASCII : REP_CODE.FDOUBL], [curve.unit],
                            [curve.dimension], [], [curve.dimension], []]
                    })
                }
                channels = channels.concat(curves);
                const datasetStep = [];
                if(dataset.step != 0){
                    datasetStep.push(parseFloat(dataset.step));
                }
                frames.push({
                    origin: origin,
                    copy_number: 0,
                    name: dataset.name,
                    attribs: [[], curves, ["BOREHOLE-DEPTH"], ["INCREASING"], datasetStep, [], [parseFloat(dataset.top)], [parseFloat(dataset.bottom)]]
                })
            }

            //write channel
            const channelSet = {
                type: "CHANNEL",
                template: TEMPLATE.CHANNL,
                objects: channels
            }
            encodeSet(channelSet);

            //write frame
            const frameSet = {
                type: "FRAME",
                template: TEMPLATE.FRAME,
                objects: frames
            }
            encodeSet(frameSet);

            //write data
            const curves = []
            async function encodeDatasetData(dataset){
                return new Promise(async function(resolve, reject) {
                    try {
                        let activeStream = dataset.curves.length;
                        curves.length = 0;
                        let frameIdx = 1;
                        let readable = 0;
                        for (const [idx, curve] of dataset.curves.entries()) {
                            let stream = await curveData(curve);
                            stream = byline.createStream(stream, {encoding: "utf8"}).pause();
                            const item = {
                                repcode: curve.type == "TEXT" ? REP_CODE.ASCII : REP_CODE.FDOUBL,
                                dimension: curve.dimension ? curve.dimension : 1,
                                rl: stream,
                                closed: false
                            }
                            curves.push(item)
                            stream.on('data', (line) => {
                                stream.pause();
                                line = line.replace(/\s\s+/g, ' ');
                                const arr = customSplit(line, " ");
                                if (idx == 0) {
                                    //start a frame
                                    //currently, 1 vr = 1 lrs = 1 frame, will be improved in the future
                                    encodeIflrHeader({
                                        origin: dataset.origin,
                                        copy_number: 0,
                                        name: dataset.name
                                    }, frameIdx);
                                    let index = 0;
                                    if (dataset.step != 0) {
                                        index = parseFloat(dataset.top) + (frameIdx - 1) * dataset.step;
                                    } else {
                                        index = parseFloat(arr[0]);
                                    }
                                    const bytes = encodeIflrData(REP_CODE.FDOUBL, index);
                                    lrsLen += bytes;
                                }
                                for (let i = 1; i <= curve.dimension; i++) {
                                    if (arr[i])
                                        bytes = encodeIflrData(item.repcode, arr[i]);
                                    else
                                        bytes = encodeIflrData(item.repcode, NULL_VALUE);
                                    lrsLen += bytes;
                                }
                                if (idx == dataset.curves.length - 1) {
                                    //end of frame
                                    writeLRSHeader(lrsIdx > 0 ? 0b01000000 : 0b00000000, 0b00000000); //lrs length
                                    vrLen += lrsLen;
                                    writeVRLen();
                                    if(activeStream < curves.length) {
                                        console.log("dlis export done 1 " + dataset.name);
                                        resolve()
                                    }
                                    else {
                                        frameIdx += 1;
                                        curves[0].rl.resume();
                                    }
                                    //console.log(buffer.buffs[buffer.bufferIdx].slice(vrStartIdx, vrStartIdx + 8))
                                }
                                else {
                                    curves[idx + 1].rl.resume();
                                }
                            })
                            stream.on('end', () => {
                                activeStream -= 1;
                                if(!stream.isPaused()){
                                    stream.pause()
                                    if(curves[idx+1])
                                        curves[idx+1].rl.resume()
                                }
                                item.closed = true
                                console.log("dlis export " + curve.name + " closed " + idx + "\t remain " + activeStream)
                                if (activeStream == 0) {
                                    console.log("dlis export done 2 " + dataset.name);
                                    resolve();
                                }
                            })
                        }
                        curves[0].rl.resume();
                        
                    }
                    catch (err){
                        console.log("dlis export err: " + err);
                        throw err;
                    }

                })
            }

            for(const dataset of well.datasets){
                try{
                    await encodeDatasetData(dataset);
                }
                catch(err) {
                    err.message = "encodeDatasetData: " + err.message;
                    throw err;
                }
            }
        }


        function encodeIflrHeader(obname, frameIdx){
            try{
                //console.log("====== encodeIflrHeader "+frameIdx +" ======= " + buffer.writeIdx);
                lrsType = 0x00;
                lrsIdx = 0;
                createVR();
                createLRS(lrsType);
                //console.log("===========> "+ buffer.writeIdx);
                let bytes = 0;
                bytes = encoder.encode(buffer, REP_CODE.OBNAME, obname);
                //update state
                if(buffer.writeIdx + bytes < buffer.buffSize){
                    buffer.writeIdx += bytes;
                }
                else {
                    changeBuffer(bytes);
                }
                lrsLen += bytes;
                buffer.reRemain -= bytes;
                bytes = encoder.encode(buffer, REP_CODE.UVARI, frameIdx);
                //update state
                if(buffer.writeIdx + bytes < buffer.buffSize){
                    buffer.writeIdx += bytes;
                }
                else {
                    changeBuffer(bytes);
                }
                lrsLen += bytes;
                buffer.reRemain -= bytes;
            }
            catch(err){
                err.message = "encodeIflrHeader: " + err.message;
                throw err;
            }
        }
        function encodeIflrData(repcode, data){
            try{
                if(repcode == REP_CODE.FDOUBL && isNaN(data)){
                    data = NULL_VALUE;
                }
                const bytes = encoder.encode(buffer, repcode, data);
                //update state
                if(bytes < 0){
                    writeLRSHeader(lrsIdx == 0 ? 0b00100000 : 0b01100000); //lrs length
                    vrLen += lrsLen;
                    writeVRLen();
                    lrsIdx += 1;
                    createVR();
                    createLRS(lrsType);
                    return encodeIflrData(repcode, data);
                }
                else {
                    if(buffer.writeIdx + bytes < buffer.buffSize){
                        buffer.writeIdx += bytes;
                    }
                    else {
                        changeBuffer(bytes);
                    }
                    return bytes;
                }
            }
            catch(err){
                err.message = "encodeIflrData: " + err.message;
                throw err;
            }
        }

        function encodeSet(set) {
            try{
                //haven't checked vr max length, will be implemented in the future
                createVR();
                lrsType = EFLR[set.type];
                createLRS(lrsType);
                lrsIdx = 0;
                let compLen = 0;
                if(set.name){
                    compLen = encodeComponent(COMPONENT_ROLE.SET, 0b11000, set.type, set.name);
                }else {
                    compLen = encodeComponent(COMPONENT_ROLE.SET, 0b10000, set.type);
                }
                lrsLen += compLen;
                //encode template
                for(const [i, item] of set.template.entries()){
                    let format = 0b10000;
                    let repcode = item.repcode;
                    if(item.count) format = format | 0b01000;
                    if(item.repcode) {
                        format = format | 0b00100;
                    }/*
                    else {
                        //encode repcode of template following data of attributes
                        //if not, default repcode is IDENT
                        format = format | 0b00100;
                        repcode = REP_CODE.FDOUBL; 
                    }*/
                    compLen = encodeComponent(COMPONENT_ROLE.ATTRIB, format, item.label, item.count, repcode);
                    lrsLen += compLen;
                }
                //encode objects
                for(const obj of set.objects){
                    compLen = encodeComponent(COMPONENT_ROLE.OBJECT, 0b10000, obj);
                    lrsLen += compLen;
                    const values = {
                        repcode: 0,
                        count: 1,
                        values: []
                    }
                    for(let i = 0; i < obj.attribs.length; i++){
                        let _format = 0b00001;
                        if(obj.attribs[i].length == 0){
                            compLen = encodeComponent(COMPONENT_ROLE.ABSATR);
                            lrsLen += compLen;
                        }
                        else{
                            if(set.template[i].repcode){
                                values.repcode = set.template[i].repcode;
                            }
                            else {
                                _format = _format | 0b00100;
                                if(isNaN(obj.attribs[i][0])){
                                    values.repcode = REP_CODE.ASCII;
                                }else {
                                    values.repcode = REP_CODE.FDOUBL;
                                }
                            }
                            values.count = set.template.count ? set.template.count : obj.attribs[i].length;
                            values.values = obj.attribs[i];
                            if(values.count > 1){
                                _format = _format | 0b01000;
                            }
                            compLen = encodeComponent(COMPONENT_ROLE.ATTRIB, _format, null, values.count, values.repcode, null, values)
                            lrsLen += compLen;
                        }
                    }
                }
                writeLRSHeader(lrsIdx == 0? 0b10000000 : 0b11000000); //lrs length
                vrLen += lrsLen;
                writeVRLen();
            }
            catch (err){
                err.message = "encodeSet: " + err.message;
                console.log("encodeSer err: " + JSON.stringify(set));
                throw err;
            }
        }
        function writeToBuffer(bytes){
            try{
                if(bytes.length == 0) return;
                if(bytes.length < buffer.buffSize - buffer.writeIdx){
                    for(let i = 0; i < bytes.length; i++){
                        buffer.buffs[buffer.bufferIdx].writeUInt8(bytes[i], buffer.writeIdx + i);
                    }
                    //update state
                    buffer.writeIdx += bytes.length;
                }
                else {
                    const remainLen = buffer.buffSize - buffer.writeIdx;
                    for(let i = 0; i < remainLen; i++){
                        buffer.buffs[buffer.bufferIdx].writeUInt8(bytes[i], buffer.writeIdx + i);
                    }
                    changeBuffer(remainLen);
                    writeToBuffer(bytes.slice(remainLen));
                }
            }
            catch(err){
                err.message = "writeToBuffer: " + err.message;
                throw err;
            }
        }
        function changeBuffer(bytes){ //write current buffer to file
            try{
                //console.log("changeBuffer writeableIdx " + buffer.writableIdx + " bufferIdx " + buffer.bufferIdx);
                if(buffer.writableIdx == -1 && buffer.bufferIdx == 0){
                    //do nothing
                }
                else {
                    if(buffer.writableIdx == -1 && fs.existsSync(exportPath)){
                        fs.unlinkSync(exportPath);
                    }
                    buffer.writableIdx = (buffer.writableIdx + 1) % buffer.buffCount;
                    //const ret = buffer.wstream.write(buffer.buffs[buffer.writableIdx]);
                    //console.log("changeBuffer write " + ret);
                    fs.appendFileSync(exportPath, buffer.buffs[buffer.writableIdx]);
                }
                buffer.bufferIdx = (buffer.bufferIdx + 1) % buffer.buffCount;
                buffer.writeIdx = buffer.writeIdx + bytes - buffer.buffSize;
            }
            catch(err) {
                err.message = "changeBuffer: " + err.message
                throw err;
            }
        }
        function encodeComponent(role, format, args1, args2, args3, args4, args5){ //return -1 if 
            try{
                //console.log("encodeComponent " + buffer.writeIdx + " header " + (role << 5 | format));
                const sBufferIdx = buffer.bufferIdx;
                const sWriteIdx = buffer.writeIdx;
                writeToBuffer([role << 5 | format]); //write component header
                let len = 1;
                buffer.vrRemain -= 1;
                let bytes = 0;
                let _compLen = 0;
                function updateState(bytes){
                    if(bytes < 0){
                        buffer.bufferIdx = sBufferIdx;
                        buffer.writeIdx = sWriteIdx;
                        writeLRSHeader(lrsIdx == 0 ? 0b10100000 : 0b11100000); //lrs length
                        vrLen += lrsLen;
                        writeVRLen();
                        lrsIdx += 1;
                        createVR();
                        createLRS(lrsType);
                        return encodeComponent(role, format, args1, args2, args3, args4, args5);
                    }
                    else {
                        len += bytes;
                        buffer.vrRemain -= bytes;
                        if(buffer.writeIdx + bytes < buffer.buffSize){
                            buffer.writeIdx += bytes;
                        }
                        else {
                            changeBuffer(bytes);
                        }
                        return -1;
                    }
                }
                switch (role){
                    case COMPONENT_ROLE.ABSATR:
                        break;
                    case COMPONENT_ROLE.ATTRIB:
                    case COMPONENT_ROLE.INVATR:
                        if(format & 0b00010000 && args1) {
                            bytes = encoder.encode(buffer, REP_CODE.IDENT, args1); // label
                            _compLen = updateState(bytes);
                            if(_compLen > 0){
                                return _compLen;
                            }
                        }
                        if(format & 0b00001000 && args2) {
                            bytes = encoder.encode(buffer, REP_CODE.UVARI, args2); // count
                            _compLen = updateState(bytes);
                            if(_compLen > 0){
                                return _compLen;
                            }
                        }
                        if(format & 0b00000100 && args3) {
                            bytes = encoder.encode(buffer, REP_CODE.USHORT, args3); // representation code
                            _compLen = updateState(bytes);
                            if(_compLen > 0){
                                return _compLen;
                            }
                        }
                        if(format & 0b00000010 && args4) {
                            bytes = encoder.encode(buffer, REP_CODE.IDENT, args4); // units
                            _compLen = updateState(bytes);
                            if(_compLen > 0){
                                return _compLen;
                            }
                        }
                        if(format & 0b00000001 && args5) {
                            for(const val of args5.values){
                                bytes = encoder.encode(buffer, args5.repcode, val);
                                _compLen = updateState(bytes);
                                if(_compLen > 0){
                                    return _compLen;
                                }
                            }
                        }
                        break;
                    case COMPONENT_ROLE.OBJECT:
                        bytes = encoder.encode(buffer, REP_CODE.OBNAME, args1); //args1 == obname 
                        _compLen = updateState(bytes);
                        if(_compLen > 0){
                            return _compLen;
                        }
                        break;
                    case COMPONENT_ROLE.RDSET:
                    case COMPONENT_ROLE.RSET:
                    case COMPONENT_ROLE.SET:
                        bytes = encoder.encode(buffer, REP_CODE.IDENT, args1); // args1 == Type
                        _compLen = updateState(bytes);
                        if(_compLen > 0){
                            return _compLen;
                        }
                        if(args2) {
                            bytes = encoder.encode(buffer, REP_CODE.IDENT, args2); // args2 == name
                            _compLen = updateState(bytes);
                            if(_compLen > 0){
                                return _compLen;
                            }
                        }
                        break;
                    default:
                        break;
                }
                return len;
            }
            catch(err){
                err.message = "encodeComponent: " + err.message;
                throw err;
            }
        }

        function createVR(){
            buffer.vrRemain = VR_MAX_LEN;
            vrStartIdx = buffer.writeIdx;
            writeToBuffer([0x00, 0x00, 0xFF, 0x01]); //vr header
            vrLen = 4;
            buffer.vrRemain -= 4;
        }

        function createLRS(type){
            lrsStartIdx = buffer.writeIdx;
            writeToBuffer([0x00, 0x00, 0x00, type]); //lrs header
            lrsLen = 4;
            buffer.vrRemain -= 4;
        }

        function writeVRLen(){
            try{
                let bufferIdx = buffer.bufferIdx;
                if(vrStartIdx > buffer.writeIdx){
                    bufferIdx = buffer.bufferIdx == 0 ? buffer.buffCount - 1 : buffer.bufferIdx - 1;
                }
                //console.log("writeVRLen bufferIdx "+ bufferIdx + " writeIdx " + vrStartIdx +" len "  + vrLen);
                //console.log(buffer.buffs[bufferIdx].slice(vrStartIdx, vrStartIdx + 10));
                if(buffer.buffSize - vrStartIdx < 2){
                    const buff = Buffer.alloc(2, 0);
                    buff.writeUInt16BE(vrLen);
                    buff.copy(buffer.buffs[bufferIdx], vrStartIdx, 0, 1);
                    buff.copy(buffer.buffs[(bufferIdx + 1) % buffer.buffCount], 0, 1, 2);
                }
                else {
                    buffer.buffs[bufferIdx].writeUInt16BE(vrLen, vrStartIdx);
                }
            }
            catch(err){
                err.message = "writeVRLen: " + err.message;
                throw err;
            }
            //console.log(buffer.buffs[bufferIdx].slice(vrStartIdx, vrStartIdx + 10));
        }
        function writeLRSHeader(attributes, type){
            try{
                if(lrsLen % 2 == 1){
                    attributes = attributes | 0b00000001;//pad bytes are presented 
                    writeToBuffer([0x01]); //pad count
                    lrsLen += 1;
                }
                //console.log("LRS len: "+lrsLen);
                let bufferIdx = buffer.bufferIdx;
                if(lrsStartIdx > buffer.writeIdx){
                    bufferIdx = buffer.bufferIdx == 0 ? buffer.buffCount - 1 : buffer.bufferIdx - 1;
                }
                //write lrs length
                if(buffer.buffSize - lrsStartIdx < 2){
                    const buff = Buffer.alloc(2, 0);
                    buff.writeUInt16BE(lrsLen);
                    buff.copy(buffer.buffs[bufferIdx], lrsStartIdx, 0, 1);
                    buff.copy(buffer.buffs[(bufferIdx + 1) % buffer.buffCount], 0, 1, 2);
                }
                else {
                    buffer.buffs[bufferIdx].writeUInt16BE(lrsLen, lrsStartIdx);
                }
                //write lrs attributes
                if(lrsStartIdx + 2 < buffer.buffSize){
                    buffer.buffs[bufferIdx].writeUInt8(attributes, lrsStartIdx + 2);
                }
                else {
                    buffer.buffs[(bufferIdx + 1) % buffer.buffCount].writeUInt8(attributes, lrsStartIdx + 2 - buffer.buffSize)
                }
                //write lrs type
                if(type){
                    if(lrsStartIdx + 3 < buffer.buffSize){
                        buffer.buffs[bufferIdx].writeUInt8(type, lrsStartIdx + 3);
                    }
                    else {
                        buffer.buffs[(bufferIdx + 1) % buffer.buffCount].writeUInt8(type, lrsStartIdx + 3 - buffer.buffSize)
                    }
                }
            }
            catch(err){
                err.message = "writeLRSHeader: " + err.message;
                throw err;
            }
        }

        //write what's left in buffer to file
        if(buffer.writableIdx == -1){
            for(let i = 0; i < buffer.bufferIdx; i++){
                //buffer.wstream.write(buffer.buffs[i]);
                fs.appendFileSync(exportPath, buffer.buffs[i]);
            }
        }
        else {
            if(buffer.bufferIdx == 0){
                //buffer.wstream.write(buffer.buffs[buffer.buffCount - 1]);
                fs.appendFileSync(exportPath, buffer.buffs[buffer.buffCount -1]);
            } else {
                fs.appendFileSync(exportPath, buffer.buffs[buffer.bufferIdx -1]);
                //buffer.wstream.write(buffer.buffs[buffer.bufferIdx - 1]);
            }
        }
        const lastBuff = Buffer.alloc(buffer.writeIdx, 0);
        buffer.buffs[buffer.bufferIdx].copy(lastBuff, 0, 0, buffer.writeIdx);
        //buffer.wstream.write(lastBuff);
        fs.appendFileSync(exportPath, lastBuff);
        return Promise.resolve();
    }
    catch(err){
        console.log("dlis export err: "+ err);
        return Promise.reject(err);
    }
}


module.exports = function(_config){
    Object.assign(config, _config);
    s3 = require('./S3.js');
    const module = {
        export: dlisExport
    };
    return module;
}

