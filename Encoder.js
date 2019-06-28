'use strict'
const REP_CODE = {
    FSHORT :   1,      //2
    FSINGL :   2,      //4
    FSING1 :   3,      //8
    FSING2 :   4,      //12
    ISINGL :   5,      //4
    VSINGL :   6,      //4
    FDOUBL :   7,      //8
    FDOUB1 :   8,      //16
    FDOUB2 :   9,      //24
    CSINGL :   10,     //8
    CDOUBL :   11,     //16
    SSHORT :   12,     //1
    SNORM :    13,     //2
    SLONG :    14,     //4
    USHORT :   15,     //1
    UNORM :    16,     //2
    ULONG :    17,     //4
    UVARI :    18,     //1, 2 or 4
    IDENT :    19,     //V
    ASCII :    20,     //V
    DTIME :    21,     //8
    ORIGIN :   22,     //V
    OBNAME :   23,     //V
    OBJREF :   24,     //V
    ATTREF :   25,     //V
    STATUS :   26,     //1
    UNITS :    27,     //V
    REPCODE_MAX : 28
}
const NULL_VAL = -9999

function encode(buffer, code, value){
    //console.log("encode " + code + "||" + JSON.stringify(value)+"||"+buffer.bufferIdx+"||"+buffer.writeIdx);
    try{
        if(!code){
            process.exit(1);
        }
        let len = 0;
        switch(code){
            case REP_CODE.FSHORT:
                break;
            case REP_CODE.FSINGL:
                len = encodeFsingl(buffer.buffs, buffer.bufferIdx, buffer.writeIdx, value);
                break;
            case REP_CODE.FSING1:
                break;
            case REP_CODE.FSING2:
                break;
            case REP_CODE.ISINGL:
                break;
            case REP_CODE.VSINGL:
                break;
            case REP_CODE.FDOUBL:
                len = encodeFdoubl(buffer.buffs, buffer.bufferIdx, buffer.writeIdx, value);
                break;
            case REP_CODE.FDOUB1:
                break;
            case REP_CODE.FDOUB2:
                break;
            case REP_CODE.CSINGL:
                break;
            case REP_CODE.CDOUBL:
                break;
            case REP_CODE.SSHORT:
                break;
            case REP_CODE.SNORM:
                break;
            case REP_CODE.SLONG:
                break;
            case REP_CODE.USHORT:
                len = encodeUshort(buffer.buffs, buffer.bufferIdx, buffer.writeIdx, value);
                break;
            case REP_CODE.UNORM:
                len = encodeUnorm(buffer.buffs, buffer.bufferIdx, buffer.writeIdx, value);
                break;
            case REP_CODE.ULONG:
                len = encodeUlong(buffer.buffs, buffer.bufferIdx, buffer.writeIdx, value);
                break;
            case REP_CODE.UVARI:
            case REP_CODE.ORIGIN:
                len = encodeUvari(buffer.buffs, buffer.bufferIdx, buffer.writeIdx, value);
                break;
            case REP_CODE.IDENT:
            case REP_CODE.UNITS:
                len = encodeIdent(buffer.buffs, buffer.bufferIdx, buffer.writeIdx, value);
                break;
            case REP_CODE.ASCII:
                len = encodeAscii(buffer.buffs, buffer.bufferIdx, buffer.writeIdx, value);
                break;
            case REP_CODE.OBNAME:
                len = encodeObname(buffer.buffs, buffer.bufferIdx, buffer.writeIdx, value);
                break;
            case REP_CODE.DTIME:
                len = encodeDtime(buffer.buffs, buffer.bufferIdx, buffer.writeIdx, value);
                break;
            case REP_CODE.OBJREF:
                len = encodeObjref(buffer.buffs, buffer.bufferIdx, buffer.writeIdx, value);
                break;
            case REP_CODE.ATTREF:
                break;
            case REP_CODE.STATUS:
                break;
        }
        if(len > buffer.vrRemain){
            return -1;
        }
        else return len;
    }
    catch(err){
        err.message = "encode: " + err.message
        throw err;
    }
}
function encodeIdent(buffs, buffIdx, writeIdx, str){
    if(str.length > 255) {
        console.log("encodeIdent string is too large!!!");
        return;
    }
    if(buffs[buffIdx].length - writeIdx < str.length + 1){
        const buff = Buffer.alloc(str.length + 1, 0);
        buff.writeUInt8(str.length, 0);
        buff.write(str, 1);
        writeOverBufferSize(buffs, buffIdx, writeIdx, buff); 
    }
    else {
        buffs[buffIdx].writeUInt8(str.length, writeIdx);
        buffs[buffIdx].write(str, writeIdx + 1);
    }
    return str.length + 1;
}
function encodeObname(buffs, buffIdx, writeIdx, obname){
    let len = 0;
    let bytes = 0;
    bytes = encodeUvari(buffs, buffIdx, writeIdx, obname.origin);
    if(bytes == -1) return -1;
    else {
        len += bytes;
        if(writeIdx + bytes >= buffs[buffIdx].length){
            buffIdx = (buffIdx + 1) % buffs.length;
            writeIdx = bytes - (buffs[buffIdx].length - writeIdx);
        }
        else {
            writeIdx += bytes;
        }
    }
    bytes = encodeUshort(buffs, buffIdx, writeIdx, obname.copy_number);
    if(bytes == -1) return -1;
    else {
        len += bytes;
        if(writeIdx + bytes >= buffs[buffIdx].length){
            buffIdx = (buffIdx + 1) % buffs.length;
            writeIdx = bytes - (buffs[buffIdx].length - writeIdx);
        }
        else {
            writeIdx += bytes;
        }
    }
    bytes = encodeIdent(buffs, buffIdx, writeIdx, obname.name);
    if(bytes == -1) return -1;
    else {
        len += bytes;
        if(writeIdx + bytes >= buffs[buffIdx].length){
            buffIdx = (buffIdx + 1) % buffs.length;
            writeIdx = bytes - (buffs[buffIdx].length - writeIdx);
        }
        else {
            writeIdx += bytes;
        }
    }
    return len;
}
function encodeFsingl(buffs, buffIdx, writeIdx, val){
    if(val == "" || isNaN(val)){
        val = NULL_VAL;
    }
    else{
        val = parseFloat(val);
    }
    const remain = buffs[buffIdx].length - writeIdx;
    if(remain < 4){
        const tmpBuff = Buffer.alloc(4, 0);
        tmpBuff.writeFloatBE(val);
        writeOverBufferSize(buffs, buffIdx, writeIdx, tmpBuff);
    }
    else{
        buffs[buffIdx].writeFloatBE(val, writeIdx);
    }
    return 4;
}
function encodeFdoubl(buffs, buffIdx, writeIdx, val){
    if(val == "" || isNaN(val)){
        val = NULL_VAL;
    }
    else{
        val = parseFloat(val);
    }
    if(buffs[buffIdx].length - writeIdx < 8){
        const buff = Buffer.alloc(8, 0);
        buff.writeDoubleBE(val, 0);
        writeOverBufferSize(buffs, buffIdx, writeIdx, buff);
    }
    else {
        buffs[buffIdx].writeDoubleBE(val, writeIdx);
    }
    return 8;
}
function encodeUvari(buffs, buffIdx, writeIdx, val){
    if(isNaN(val)){
        val = parseInt(val);
    }
    let len = 0;
    if(val < 0 || val >= 1073741824){
        console.log("encodeUvari value out of range");
        return;
    }else if(val < 128){
        len = encodeUshort(buffs, buffIdx, writeIdx, val);
    } else if(val < 16384){
        len = encodeUnorm(buffs, buffIdx, writeIdx, val | 0x8000);
    } else {
        len = encodeSlong(buffs, buffIdx, writeIdx, val | 0xC0000000)
    }
    return len;
}
function encodeSlong(buffs, buffIdx, writeIdx, val){
    if(isNaN(val)){
        val = parseInt(val);
    }
    if(buffs[buffIdx].length - writeIdx < 4){
        const buff = Buffer.alloc(4, 0);
        buff.writeInt32BE(val, 0);
        writeOverBufferSize(buffs, buffIdx, writeIdx, buff);
    }
    else {
        buffs[buffIdx].writeInt32BE(val, writeIdx);
    }
    return 4;
}
function encodeUnorm(buffs, buffIdx, writeIdx, val){
    if(isNaN(val)){
        val = parseInt(val);
    }
    if(buffs[buffIdx].length - writeIdx < 2){
        const buff = Buffer.alloc(2, 0);
        buff.writeUInt16BE(val, 0);
        writeOverBufferSize(buffs, buffIdx, writeIdx, buff);
    }
    else {
        buffs[buffIdx].writeUInt16BE(val, writeIdx);
    }
    return 2;
}
function encodeUshort(buffs, buffIdx, writeIdx, val){
    if(isNaN(val)){
        val = parseInt(val);
    }
    if(buffs[buffIdx].length - writeIdx < 1){
        buffIdx = (buffIdx + 1)% buffs.length;
        buffs[buffIdx].writeUInt8(val, 0);
    }
    else {
        buffs[buffIdx].writeUInt8(val, writeIdx);
    }
    return 1;
}
function encodeUlong(buffs, buffIdx, writeIdx, val){
    if(isNaN(val)){
        val = parseInt(val);
    }
    if(buffs[buffIdx].length - writeIdx < 4){
        const buff = Buffer.alloc(4, 0);
        buff.writeUInt32BE(val, 0);
        writeOverBufferSize(buffs, buffIdx, writeIdx, buff);
    }
    else {
        buffs[buffIdx].writeUInt32BE(val, writeIdx);
    }
    return 4;
}
function encodeAscii(buffs, buffIdx, writeIdx, val){
    val = val.toString();
    let len = encodeUvari(buffs, buffIdx, writeIdx, val.length);
    if(len == -1) return -1;
    if(writeIdx + len > buffs[buffIdx].length){
        buffIdx = (buffIdx + 1)% buffs.length;
        writeIdx = bytes - (buffs[buffIdx].length - writeIdx);
    }
    else {
        writeIdx += len;
    }
    if(buffs[buffIdx].length - writeIdx < val.length){
        const buff = Buffer.from(val);
        writeOverBufferSize(buffs, buffIdx, writeIdx, buff);
    }
    else {
        buffs[buffIdx].write(val, writeIdx);
    }
    len += val.length;
    return len;
}
function encodeDtime(buffs, buffIdx, writeIdx, val){
    if(buffs[buffIdx].length - writeIdx < 8){
        const buff = Buffer.alloc(8, 0);
        buff.writeUInt8(val.y - 1900);
        buff.writeUInt8(val.tz << 4 | val.m, 1);
        buff.writeUInt8(val.d, 2);
        buff.writeUInt8(val.h, 3);
        buff.writeUInt8(val.mn, 4);
        buff.writeUInt8(val.s, 5);
        buff.writeUInt16BE(val.ms, 6);
        writeOverBufferSize(buffs, buffIdx, writeIdx, buff);
    }
    else {
        const buff = buffs[buffIdx];
        buff.writeUInt8(val.y - 1900, writeIdx);
        buff.writeUInt8(val.tz << 4 | val.m, writeIdx + 1);
        buff.writeUInt8(val.d, writeIdx + 2);
        buff.writeUInt8(val.h, writeIdx + 3);
        buff.writeUInt8(val.mn, writeIdx + 4);
        buff.writeUInt8(val.s, writeIdx + 5);
        buff.writeUInt16BE(val.ms, writeIdx + 6);
    }
    return 8;
}
function encodeObjref(buffs, buffIdx, writeIdx, val){
    let len = 0;
    let bytes = 0;
    bytes = encodeIdent(buffs, buffIdx, writeIdx, val.type);
    if(bytes == -1) return -1;
    else {
        len += bytes;
        if(writeIdx + bytes < buffs[buffIdx].length){
            writeIdx += bytes;
        }
        else {
            buffIdx = (buffIdx + 1)% buffs.length;
            writeIdx = bytes - (buffs[buffIdx].length - writeIdx);
        }
    }
    bytes = encodeObname(buffs, buffIdx, writeIdx, val);
    if(bytes == -1) return -1;
    else len += bytes;
    return len;
}

function writeOverBufferSize(buffs, buffIdx, writeIdx, tmpBuff){
    const remain = buffs[buffIdx].length - writeIdx;
    tmpBuff.copy(buffs[buffIdx], writeIdx, 0, remain);
    buffIdx = (buffIdx + 1) % buffs.length;
    tmpBuff.copy(buffs[buffIdx], 0, remain, tmpBuff.length);
}

module.exports = {
    encode: encode,
    REP_CODE: REP_CODE
}
