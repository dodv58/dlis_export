const fs = require('fs');
const encoder = require('./Encoder.js');
const REP_CODE = encoder.REP_CODE;
const TEMPLATE = require("./Template.js");

const COMPONENT_ROLE = {
    ABSATR: 0,
    ATTRIB: 1,
    INVATR: 2,
    OBJECT: 3,
    RDSET: 5,
    RSET: 6,
    SET: 7
    };
const VR_MAX_LEN = 8192;
const EFLR = {
    "FILE-HEADER": 0,
    "ORIGIN": 1,
    "CHANNEL": 3,
    "FRAME": 4
}

function dlisExport(wells){
    const buffer = {
        buffs: [],
        writeIdx: 0,
        bufferIdx: 0,
        writableIdx: -1,
        buffSize: 10000,
        buffCount: 5,
        wstream: fs.createWriteStream("tmp.dlis")
    }
    for(let i = 0; i < buffer.buffCount; i++){
        buffer.buffs.push(Buffer.alloc(buffer.buffSize, 0));
    }
    let vrStartIdx = 0; //index of the first byte of current vr in buff
    let lrsStartIdx = 0; //infex of the first byte of current lrs in buff
    let vrLen = 0; //length of current vr does not include the header
    let lrsLen = 0; //length of current lrs does not include the header

    //write SUL
    buffer.buffs[buffer.bufferIdx].write('   1');
    buffer.buffs[buffer.bufferIdx].write('V1.00', 4);
    buffer.buffs[buffer.bufferIdx].write('RECORD', 9);
    buffer.buffs[buffer.bufferIdx].write(' 8192', 15);
    buffer.buffs[buffer.bufferIdx].write('ssi Default Storage Set', 20);
    buffer.writeIdx = 80;

    const cTime = new Date();
    const cTimeObj = {y:cTime.getUTCFullYear(), tz:2, m:cTime.getUTCMonth() + 1, d:cTime.getUTCDate(), h:cTime.getUTCHours(), mn:cTime.getUTCMinutes(), s:cTime.getUTCSeconds(), ms:cTime.getUTCMilliseconds()};

    for(const well of wells){
        //write FHLR
        let origin = 0;
        const fhlr = {
            name: "hihi",
            type: "FILE-HEADER",
            template: [{label: "SEQUENCE-NUMBER", repcode: REP_CODE.ASCII, count: 1}, {label: "ID", repcode: REP_CODE.ASCII}],
            objects: [{origin: origin, copy_number: 0, name: "test", attribs: [["1"], ["1"]]}]
        }
        encodeSet(fhlr);

        //write origin
        const olr = {
            name: "origin",
            type: "ORIGIN",
            template: TEMPLATE.OLR,
            objects: [{
                origin: 1,
                copy_number: 0,
                name: "Defining Origin",
                attribs: [["123"], ["456"], [1], [1], ["FILE-TYPE"], ["product"], ["version"], ["programs"], 
                    [cTimeObj], [], [], [], [], [well.name], [], [], [], [], [], []]
            }]
        }
        encodeSet(olr);

        let channels = []
        const frames = []
        for(const dataset of well.datasets){
            origin += 1;
            const curves = [];
            for(const curve of dataset.curves){
                curves.push({
                    origin: origin,
                    copy_number: 0,
                    name: curve.name,
                    attribs: [[curve.description], [], [curve.type == "TEXT"? REP_CODE.ASCII : REP_CODE.FDOUBL], [curve.unit], 
                        [curve.dimension], [], [], []]
                })
            }
            channels = channels.concat(curves);
            frames.push({
                origin: origin,
                copy_number: 0,
                name: dataset.name,
                attribs: [[], curves, [], [], [], [], [], []]
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
    }
     
    //write to file
    if(buffer.writableIdx == -1){
        for(let i = 0; i < buffer.bufferIdx; i++){
            buffer.wstream.write(buffer.buffs[i]);
        }
    }
    else {
        if(buffer.bufferIdx == 0){
            buffer.wstream.write(buffer.buffs[buffer.buffCount - 1]);
        } else {
            buffer.wstream.write(buffer.buffs[buffer.bufferIdx - 1]);
        }
    }
    const lastBuff = Buffer.alloc(buffer.writeIdx, 0);
    buffer.buffs[buffer.bufferIdx].copy(lastBuff, 0, 0, buffer.writeIdx);
    buffer.wstream.write(lastBuff);

    function encodeSet(set) {
        vrStartIdx = buffer.writeIdx;
        writeToBuffer([0x00, 0x00, 0xFF, 0x01]); //vr header
        vrLen = 4;
        lrsStartIdx = buffer.writeIdx;
        writeToBuffer([0x00, 0x00, 0x00, EFLR[set.type]]); //lrs header
        lrsLen = 4;
        if(set.name){ 
            lrsLen += encodeComponent(COMPONENT_ROLE.SET, 0b11000, set.type, set.name);
        }else {
            lrsLen += encodeComponent(COMPONENT_ROLE.SET, 0b10000, set.type);
        }
        //encode template
        for(const item of set.template){
            let format = 0b10000;
            if(item.count) format = format | 0b01000;
            if(item.repcode) format = format | 0b00100;
            lrsLen += encodeComponent(COMPONENT_ROLE.ATTRIB, format, item.label, item.count, item.repcode);
        }
        //encode objects
        for(const obj of set.objects){
            lrsLen += encodeComponent(COMPONENT_ROLE.OBJECT, 0b10000, obj);
            const values = {
                repcode: 0,
                count: 1,
                values: []
            }
            for(let i = 0; i < obj.attribs.length; i++){
                if(obj.attribs[i].length == 0){
                    lrsLen += encodeComponent(COMPONENT_ROLE.ABSATR);
                }
                else{
                    values.repcode = set.template[i].repcode;
                    values.count = set.template.count ? set.template.count : obj.attribs[i].length;
                    values.values = obj.attribs[i];
                    if(values.count > 1){
                        lrsLen += encodeComponent(COMPONENT_ROLE.ATTRIB, 0b01001, null, values.count, null, null, values)
                    }else {
                        lrsLen += encodeComponent(COMPONENT_ROLE.ATTRIB, 0b00001, null, null, null, null, values)
                    }
                }
            }
        }
        vrLen += lrsLen;
        writeLRSHeader(lrsLen, 0b10000000, 0b00000000); //lrs length
        writeVRLen(vrLen); 
    }
    function writeToBuffer(bytes){
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
            changeBuffer();
            writeToBuffer(bytes.slice(remainLen));
        }
    }
    function changeBuffer(){ //write current buffer to file
        if(buffer.writableIdx == -1 && buffer.bufferIdx == 0){
            //do nothing
        }
        else {
            buffer.writableIdx = (buffer.writableIdx + 1) % buffer.buffCount;
            buffer.wstream.write(buffer.buffs[buffer.writableIdx]);
        }
        buffer.bufferIdx = (buffer.bufferIdx + 1) % buffer.buffCount;
        buffer.writeIdx = 0;
    }
    function encodeComponent(role, format, args1, args2, args3, args4, args5){
        writeToBuffer([role << 5 | format]); //write component header
        let len = 1;
        switch (role){
            case COMPONENT_ROLE.ABSATR:
                break;
            case COMPONENT_ROLE.ATTRIB:
            case COMPONENT_ROLE.INVATR:
                if(args1) len += encoder.encode(buffer, REP_CODE.IDENT, args1); // label
                if(args2) len += encoder.encode(buffer, REP_CODE.UVARI, args2); // count
                if(args3) len += encoder.encode(buffer, REP_CODE.USHORT, args3); // representation code
                if(args4) len += encoder.encode(buffer, REP_CODE.IDENT, args4); // units
                if(args5) {
                    for(const val of args5.values){
                        len += encoder.encode(buffer, args5.repcode, val);
                    }
                }
                break;
            case COMPONENT_ROLE.OBJECT:
                len += encoder.encode(buffer, REP_CODE.OBNAME, args1); //args1 == obname 
                break;
            case COMPONENT_ROLE.RDSET:
            case COMPONENT_ROLE.RSET:
            case COMPONENT_ROLE.SET:
                len += encoder.encode(buffer, REP_CODE.IDENT, args1); // args1 == Type
                if(args2) {
                    len += encoder.encode(buffer, REP_CODE.IDENT, args2); // args2 == name
                }
                break;
            default:
                break;
        }
        return len;
    }
    function writeVRLen(len){
        console.log("writeVRLen " + len);
        let bufferIdx = buffer.bufferIdx;
        if(vrStartIdx > buffer.writeIdx){
            bufferIdx = buffer.bufferIdx == 0 ? buffer.buffCount - 1 : buffer.bufferIdx - 1;
        }
        if(buffer.buffSize - vrStartIdx < 2){
            const buff = Buffer.alloc(2, 0);
            buff.writeUInt16BE(len);
            buff.copy(buffer.buffs[buffferIdx], vrStartIdx, 0, 1);
            buff.copy(buffer.buffs[(buffferIdx + 1) % buffer.buffCount], 0, 1, 2);
        }
        else {
            buffer.buffs[bufferIdx].writeUInt16BE(len, vrStartIdx);
        }
    }
    function writeLRSHeader(len, attributes, type){
        console.log("writeLRSHeader " + len);
        let bufferIdx = buffer.bufferIdx;
        if(lrsStartIdx > buffer.writeIdx){
            bufferIdx = buffer.bufferIdx == 0 ? buffer.buffCount - 1 : buffer.bufferIdx - 1;
        }
        //write lrs length
        if(buffer.buffSize - lrsStartIdx < 2){
            const buff = Buffer.alloc(2, 0);
            buff.writeUInt16BE(len);
            buff.copy(buffer.buffs[buffferIdx], lrsStartIdx, 0, 1);
            buff.copy(buffer.buffs[(buffferIdx + 1) % buffer.buffCount], 0, 1, 2);
        }
        else {
            buffer.buffs[bufferIdx].writeUInt16BE(len, lrsStartIdx);
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
}

dlisExport([{
"idWell":2629,
"name":"1_FT_L2",
"filename":"1_FT_L2_LQC.las",
"notes":null,
"createdAt":"2019-04-01T09:23:48.000Z",
"updatedAt":"2019-04-01T09:23:48.000Z",
"username":"dodv",
"well_headers":[
{
"header":"API",
"value":"",
"unit":"",
"description":""
},
{
"header":"AREA",
"value":"",
"unit":"",
"description":""
}
],
"datasets": [{
"idDataset":12008,
"name":"LQC",
"numberOfSample":0,
"unit":"ft",
"top":"0.0",
"bottom":"13557.5",
"step":"0.5000",
"createdAt":"2019-04-01T09:23:48.000Z",
"updatedAt":"2019-04-01T09:23:48.000Z",
"idWell":2629,
"dataset_params":[
{
"idDataset":12008,
"mnem":"PROJECT_UPGRADE_TIME",
"value":"2017-09-12T18_03_55",
"unit":"",
"description":"",
"createdAt":"2019-04-01T09:23:48.000Z",
"updatedAt":"2019-04-01T09:23:48.000Z"
},
{
"idDataset":12008,
"mnem":"TLFamily_CALI",
"value":"Caliper",
"unit":"",
"description":"",
"createdAt":"2019-04-01T09:23:48.000Z",
"updatedAt":"2019-04-01T09:23:48.000Z"
}
],
"curves": [
{
"idCurve":152436,
"name":"CALI",
"description":"density caliper [5]",
"dimension":1,
"delimiter":" ",
"type":"NUMBER",
"createdAt":"2019-04-01T09:23:48.000Z",
"updatedAt":"2019-04-01T09:23:48.000Z",
"idDataset":12008,
"idRevision":151096,
"unit":"in",
"startDepth":"0.0",
"stopDepth":"13557.5",
"step":"0.5000",
"isCurrentRevision":1
},
{
"idCurve":152437,
"name":"DEN",
"description":"bulk density [13]",
"dimension":1,
"delimiter":" ",
"type":"NUMBER",
"createdAt":"2019-04-01T09:23:48.000Z",
"updatedAt":"2019-04-01T09:23:48.000Z",
"idDataset":12008,
"idRevision":151097,
"unit":"g/cm3",
"startDepth":"0.0",
"stopDepth":"13557.5",
"step":"0.5000",
"isCurrentRevision":1
},
{
"idCurve":152438,
"name":"DENC",
"description":"density correction [14]",
"dimension":1,
"delimiter":" ",
"type":"NUMBER",
"createdAt":"2019-04-01T09:23:48.000Z",
"updatedAt":"2019-04-01T09:23:48.000Z",
"idDataset":12008,
"idRevision":151098,
"unit":"g/cm3",
"startDepth":"0.0",
"stopDepth":"13557.5",
"step":"0.5000",
"isCurrentRevision":1
},
{
"idCurve":152439,
"name":"DT",
"description":"sonic openhole & 9 5/8 csg [21]",
"dimension":1,
"delimiter":" ",
"type":"NUMBER",
"createdAt":"2019-04-01T09:23:48.000Z",
"updatedAt":"2019-04-01T09:23:48.000Z",
"idDataset":12008,
"idRevision":151099,
"unit":"us/ft",
"startDepth":"0.0",
"stopDepth":"13557.5",
"step":"0.5000",
"isCurrentRevision":1
},
{
"idCurve":152440,
"name":"DTS_PY",
"description":"DTS based on VSH and SW",
"dimension":1,
"delimiter":" ",
"type":"NUMBER",
"createdAt":"2019-04-01T09:23:48.000Z",
"updatedAt":"2019-04-01T09:23:48.000Z",
"idDataset":12008,
"idRevision":151100,
"unit":"us/ft",
"startDepth":"0.0",
"stopDepth":"13557.5",
"step":"0.5000",
"isCurrentRevision":1
},
{
"idCurve":152441,
"name":"FLD",
"description":"from MDT spreadsheet JAG",
"dimension":1,
"delimiter":" ",
"type":"NUMBER",
"createdAt":"2019-04-01T09:23:48.000Z",
"updatedAt":"2019-04-01T09:23:48.000Z",
"idDataset":12008,
"idRevision":151101,
"unit":"unitless",
"startDepth":"0.0",
"stopDepth":"13557.5",
"step":"0.5000",
"isCurrentRevision":1
},
{
"idCurve":152442,
"name":"GR",
"description":"",
"dimension":1,
"delimiter":" ",
"type":"NUMBER",
"createdAt":"2019-04-01T09:23:48.000Z",
"updatedAt":"2019-04-01T09:23:48.000Z",
"idDataset":12008,
"idRevision":151103,
"unit":"gAPI",
"startDepth":"0.0",
"stopDepth":"13557.5",
"step":"0.5000",
"isCurrentRevision":1
},
{
"idCurve":152443,
"name":"HAFWL",
"description":"Height above FWL",
"dimension":1,
"delimiter":" ",
"type":"NUMBER",
"createdAt":"2019-04-01T09:23:48.000Z",
"updatedAt":"2019-04-01T09:23:48.000Z",
"idDataset":12008,
"idRevision":151104,
"unit":"ft",
"startDepth":"0.0",
"stopDepth":"13557.5",
"step":"0.5000",
"isCurrentRevision":1
},
{
"idCurve":152444,
"name":"NET",
"description":"Net Res Flag - EntOil Bateman method INVS<=0.5",
"dimension":1,
"delimiter":" ",
"type":"NUMBER",
"createdAt":"2019-04-01T09:23:48.000Z",
"updatedAt":"2019-04-01T09:23:48.000Z",
"idDataset":12008,
"idRevision":151105,
"unit":"FLAG",
"startDepth":"0.0",
"stopDepth":"13557.5",
"step":"0.5000",
"isCurrentRevision":1
},
{
"idCurve":152445,
"name":"NEU",
"description":"neutron porosity [16]",
"dimension":1,
"delimiter":" ",
"type":"NUMBER",
"createdAt":"2019-04-01T09:23:48.000Z",
"updatedAt":"2019-04-01T09:23:48.000Z",
"idDataset":12008,
"idRevision":151106,
"unit":"v/v",
"startDepth":"0.0",
"stopDepth":"13557.5",
"step":"0.5000",
"isCurrentRevision":1
},
{
"idCurve":152446,
"name":"PERF",
"description":"perf shot 13/11/00 - loaded June04",
"dimension":1,
"delimiter":" ",
"type":"NUMBER",
"createdAt":"2019-04-01T09:23:48.000Z",
"updatedAt":"2019-04-01T09:23:48.000Z",
"idDataset":12008,
"idRevision":151102,
"unit":"ft",
"startDepth":"0.0",
"stopDepth":"13557.5",
"step":"0.5000",
"isCurrentRevision":1
},
{
"idCurve":152447,
"name":"PERM",
"description":"editted in petrel",
"dimension":1,
"delimiter":" ",
"type":"NUMBER",
"createdAt":"2019-04-01T09:23:48.000Z",
"updatedAt":"2019-04-01T09:23:48.000Z",
"idDataset":12008,
"idRevision":151107,
"unit":"ft",
"startDepth":"0.0",
"stopDepth":"13557.5",
"step":"0.5000",
"isCurrentRevision":1
},
{
"idCurve":152448,
"name":"POR",
"description":"dukpet - total porosity [74]",
"dimension":1,
"delimiter":" ",
"type":"NUMBER",
"createdAt":"2019-04-01T09:23:48.000Z",
"updatedAt":"2019-04-01T09:23:48.000Z",
"idDataset":12008,
"idRevision":151111,
"unit":"v/v",
"startDepth":"0.0",
"stopDepth":"13557.5",
"step":"0.5000",
"isCurrentRevision":1
},
{
"idCurve":152449,
"name":"PORE",
"description":"Enterprise Effective Porosity from Density log",
"dimension":1,
"delimiter":" ",
"type":"NUMBER",
"createdAt":"2019-04-01T09:23:48.000Z",
"updatedAt":"2019-04-01T09:23:48.000Z",
"idDataset":12008,
"idRevision":151112,
"unit":"FRAC",
"startDepth":"0.0",
"stopDepth":"13557.5",
"step":"0.5000",
"isCurrentRevision":1
},
{
"idCurve":152450,
"name":"PORENET",
"description":"EntOil Net Porosity using net flag NETS_EO2",
"dimension":1,
"delimiter":" ",
"type":"NUMBER",
"createdAt":"2019-04-01T09:23:48.000Z",
"updatedAt":"2019-04-01T09:23:48.000Z",
"idDataset":12008,
"idRevision":151108,
"unit":"FRAC",
"startDepth":"0.0",
"stopDepth":"13557.5",
"step":"0.5000",
"isCurrentRevision":1
},
{
"idCurve":152451,
"name":"RES_DEP",
"description":"deep induction resistivity [1123]",
"dimension":1,
"delimiter":" ",
"type":"NUMBER",
"createdAt":"2019-04-01T09:23:48.000Z",
"updatedAt":"2019-04-01T09:23:48.000Z",
"idDataset":12008,
"idRevision":151109,
"unit":"ohm.m",
"startDepth":"0.0",
"stopDepth":"13557.5",
"step":"0.5000",
"isCurrentRevision":1
},
{
"idCurve":152452,
"name":"RES_MED",
"description":"medium induction resistivity [1124]",
"dimension":1,
"delimiter":" ",
"type":"NUMBER",
"createdAt":"2019-04-01T09:23:48.000Z",
"updatedAt":"2019-04-01T09:23:48.000Z",
"idDataset":12008,
"idRevision":151110,
"unit":"ohm.m",
"startDepth":"0.0",
"stopDepth":"13557.5",
"step":"0.5000",
"isCurrentRevision":1
},
{
"idCurve":152453,
"name":"RT",
"description":"dukpet - true resistivity [76]",
"dimension":1,
"delimiter":" ",
"type":"NUMBER",
"createdAt":"2019-04-01T09:23:48.000Z",
"updatedAt":"2019-04-01T09:23:48.000Z",
"idDataset":12008,
"idRevision":151113,
"unit":"ohm.m",
"startDepth":"0.0",
"stopDepth":"13557.5",
"step":"0.5000",
"isCurrentRevision":1
},
{
"idCurve":152454,
"name":"RW",
"description":"dukpet - apparent Rw [137]",
"dimension":1,
"delimiter":" ",
"type":"NUMBER",
"createdAt":"2019-04-01T09:23:48.000Z",
"updatedAt":"2019-04-01T09:23:48.000Z",
"idDataset":12008,
"idRevision":151114,
"unit":"ohm.m",
"startDepth":"0.0",
"stopDepth":"13557.5",
"step":"0.5000",
"isCurrentRevision":1
},
{
"idCurve":152455,
"name":"SH",
"description":"editted in petrel",
"dimension":1,
"delimiter":" ",
"type":"NUMBER",
"createdAt":"2019-04-01T09:23:48.000Z",
"updatedAt":"2019-04-01T09:23:48.000Z",
"idDataset":12008,
"idRevision":151115,
"unit":"v/v",
"startDepth":"0.0",
"stopDepth":"13557.5",
"step":"0.5000",
"isCurrentRevision":1
},
{
"idCurve":152456,
"name":"SHEAR_SLOWNESS_4-8-1",
"description":"",
"dimension":1,
"delimiter":" ",
"type":"NUMBER",
"createdAt":"2019-04-01T09:23:48.000Z",
"updatedAt":"2019-04-01T09:23:48.000Z",
"idDataset":12008,
"idRevision":151116,
"unit":"us/ft",
"startDepth":"0.0",
"stopDepth":"13557.5",
"step":"0.5000",
"isCurrentRevision":1
},
{
"idCurve":152457,
"name":"SW",
"description":"dukpet - water saturation [77]",
"dimension":1,
"delimiter":" ",
"type":"NUMBER",
"createdAt":"2019-04-01T09:23:48.000Z",
"updatedAt":"2019-04-01T09:23:48.000Z",
"idDataset":12008,
"idRevision":151117,
"unit":"v/v",
"startDepth":"0.0",
"stopDepth":"13557.5",
"step":"0.5000",
"isCurrentRevision":1
},
{
"idCurve":152458,
"name":"TVDSS",
"description":"",
"dimension":1,
"delimiter":" ",
"type":"NUMBER",
"createdAt":"2019-04-01T09:23:48.000Z",
"updatedAt":"2019-04-01T09:23:48.000Z",
"idDataset":12008,
"idRevision":151118,
"unit":"ft",
"startDepth":"0.0",
"stopDepth":"13557.5",
"step":"0.5000",
"isCurrentRevision":1
},
{
"idCurve":152459,
"name":"VCL",
"description":"EntOil VSH converted from % to frac & clipped min/max 0/1",
"dimension":1,
"delimiter":" ",
"type":"NUMBER",
"createdAt":"2019-04-01T09:23:48.000Z",
"updatedAt":"2019-04-01T09:23:48.000Z",
"idDataset":12008,
"idRevision":151120,
"unit":"FRAC",
"startDepth":"0.0",
"stopDepth":"13557.5",
"step":"0.5000",
"isCurrentRevision":1
},
{
"idCurve":152460,
"name":"VSH",
"description":"dukpet - shale volume [75]",
"dimension":1,
"delimiter":" ",
"type":"NUMBER",
"createdAt":"2019-04-01T09:23:48.000Z",
"updatedAt":"2019-04-01T09:23:48.000Z",
"idDataset":12008,
"idRevision":151119,
"unit":"v/v",
"startDepth":"0.0",
"stopDepth":"13557.5",
"step":"0.5000",
"isCurrentRevision":1
}
]
}]
}]);
