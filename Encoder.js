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
function encode(buffer, code, value){
    console.log("encode " + code + "||" + JSON.stringify(value) )
    let len = 0;
    switch(code){
        case REP_CODE.FSHORT:
            break;
        case REP_CODE.FSINGL:
            len = encodeFsingl(buffer, value);
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
            len = encodeFdoubl(buffer, value);
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
            len = encodeUshort(buffer, value);
            break;
        case REP_CODE.UNORM:
            len = encodeUnorm(buffer, value);
            break;
        case REP_CODE.ULONG:
            len = encodeUlong(buffer, value);
            break;
        case REP_CODE.UVARI:
        case REP_CODE.ORIGIN:
            len = encodeUvari(buffer, value);
            break;
        case REP_CODE.IDENT:
        case REP_CODE.UNITS:
            len = encodeIdent(buffer, value);
            break;
        case REP_CODE.ASCII:
            len = encodeAscii(buffer, value);
            break;
        case REP_CODE.OBNAME:
            len = encodeObname(buffer, value);
            break;
        case REP_CODE.DTIME:
            len = encodeDtime(buffer, value);
            break;
        case REP_CODE.OBJREF:
            len = encodeObjref(buffer, value);
            break;
        case REP_CODE.ATTREF:
            break;
        case REP_CODE.STATUS:
            break;
    }
    return len;
}
function encodeIdent(buffer, str){
    if(str.length > 255) {
        console.log("encodeIdent string is too large!!!");
        return;
    }
    if(buffer.buffSize - buffer.writeIdx < str.length + 1){
        const buff = Buffer.alloc(str.length + 1, 0);
        buff.writeUInt8(str.length, 0);
        buff.write(str, 1);
        writeOverBufferSize(buffer, buff); 
    }
    else {
        buffer.buffs[buffer.bufferIdx].writeUInt8(str.length, buffer.writeIdx);
        buffer.buffs[buffer.bufferIdx].write(str, buffer.writeIdx + 1);
        buffer.writeIdx += str.length + 1;
    }
    return str.length + 1;
}
function encodeObname(buffer, obname){
    let len = 0;
    len += encodeUvari(buffer, obname.origin);
    len += encodeUshort(buffer, obname.copy_number);
    len += encodeIdent(buffer, obname.name);
    return len;
}
function encodeFsingl(buffer, val){
    const remain = buffer.buffSize - buffer.writeIdx;
    if(remain < 4){
        const tmpBuff = Buffer.alloc(4, 0);
        tmpBuff.writeFloatBE(val);
        writeOverBufferSize(buffer, tmpBuff);
    }
    else{
        buffer.buffs[buffer.buffIdx].writeFloatBE(val, buffer.writeIdx);
        buffer.writeIdx += 4;
    }
    return 4;
}
function encodeFdoubl(val){
    const buff = Buffer.alloc(8, 0);
    buff.writeFloatBE(val, 0);
    return buff;
}
function encodeUvari(buffer, val){
    let len = 0;
    if(val < 0 || val >= 1073741824){
        console.log("encodeUvari value out of range");
        return -1;
    }else if(val < 128){
        len = encodeUshort(buffer, val);
    } else if(val < 16384){
        len = encodeUnorm(buffer, val | 0x8000);
    } else {
        len = encodeSlong(buffer, val | 0xC0000000)
    }
    return len;
}
function encodeSlong(buffer, val){
    if(buffer.buffSize - buffer.writeIdx < 1){
        changeBuffer(buffer);
        buffer.buffs[buffer.bufferIdx].writeInt32BE(val, buffer.writeIdx);
        buffer.writeIdx += 4;
    }
    else if(buffer.buffSize - buffer.writeIdx < 4){
        const buff = Buffer.alloc(4, 0);
        buff.writeInt32BE(val, 0);
        writeOverBufferSize(buffer, buff);
    }
    else {
        buffer.buffs[buffer.bufferIdx].writeInt32BE(val, buffer.writeIdx);
        buffer.writeIdx += 4;
    }
    return 4;
}
function encodeUnorm(buffer, val){
    if(buffer.buffSize - buffer.writeIdx < 1){
        changeBuffer(buffer);
        buffer.buffs[buffer.bufferIdx].writeUInt16BE(val, buffer.writeIdx);
        buffer.writeIdx += 2;
    }
    else if(buffer.buffSize - buffer.writeIdx < 2){
        const buff = Buffer.alloc(2, 0);
        buff.writeUInt16BE(val, 0);
        writeOverBufferSize(buffer, buff);
    }
    else {
        buffer.buffs[buffer.bufferIdx].writeUInt16BE(val, buffer.writeIdx);
        buffer.writeIdx += 2;
    }
    return 2;
}
function encodeUshort(buffer, val){
    if(buffer.buffSize - buffer.writeIdx < 1){
        changeBuffer(buffer);
    }
    buffer.buffs[buffer.bufferIdx].writeUInt8(val, buffer.writeIdx);
    buffer.writeIdx += 1;
    return 1;
}
function encodeUlong(buffer, val){
    if(buffer.buffSize - buffer.writeIdx < 1){
        changeBuffer(buffer);
        buffer.buffs[buffer.bufferIdx].writeUInt32BE(val, buffer.writeIdx);
        buffer.writeIdx += 4;
    }
    else if(buffer.buffSize - buffer.writeIdx < 4){
        const buff = Buffer.alloc(4, 0);
        buff.writeUInt32BE(val, 0);
        writeOverBufferSize(buffer, buff);
    }
    else {
        buffer.buffs[buffer.bufferIdx].writeUInt32BE(val, buffer.writeIdx);
        buffer.writeIdx += 4;
    }
    return 4;
}
function encodeAscii(buffer, val){
    let len = encodeUvari(buffer, val.length);
    if(buffer.buffSize - buffer.writeIdx < 1){
        changeBuffer(buffer);
        buffer.buffs[buffer.bufferIdx].write(val, buffer.writeIdx);
        buffer.writeIdx += val.length;
    }
    else if(buffer.buffSize - buffer.writeIdx < val.length){
        const buff = Buffer.from(val);
        writeOverBufferSize(buffer, buff);
    }
    else {
        buffer.buffs[buffer.bufferIdx].write(val, buffer.writeIdx);
        buffer.writeIdx += val.length;
    }
    len += val.length;
    return len;
}
function encodeDtime(buffer, val){
    if(buffer.buffSize - buffer.writeIdx < 1){
        changeBuffer(buffer);
    }
    if(buffer.buffSize - buffer.writeIdx < 8){
        const buff = Buffer.alloc(8, 0);
        buff.writeUInt8(val.y - 1900);
        buff.writeUInt8(val.tz << 4 | val.m, 1);
        buff.writeUInt8(val.d, 2);
        buff.writeUInt8(val.h, 3);
        buff.writeUInt8(val.mn, 4);
        buff.writeUInt8(val.s, 5);
        buff.writeUInt16BE(val.ms, 6);
        writeOverBufferSize(buffer, buff);
    }
    else {
        const buff = buffer.buffs[buffer.bufferIdx];
        const wIdx = buffer.writeIdx;
        buff.writeUInt8(val.y - 1900, wIdx);
        buff.writeUInt8(val.tz << 4 | val.m, wIdx + 1);
        buff.writeUInt8(val.d, wIdx + 2);
        buff.writeUInt8(val.h, wIdx + 3);
        buff.writeUInt8(val.mn, wIdx + 4);
        buff.writeUInt8(val.s, wIdx + 5);
        buff.writeUInt16BE(val.ms, wIdx + 6);
        buffer.writeIdx += 8;
    }
    return 8;
}
function encodeObjref(buffer, val){
    let len = encodeIdent(buffer, val.type);
    len += encodeObname(buffer, val);
    return len;
}

function changeBuffer(buffer){
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
function writeOverBufferSize(buffer, tmpBuff){
    const remain = buffer.buffSize - buffer.writeIdx;
    tmpBuff.copy(buffer.buffs[buffer.bufferIdx], buffer.writeIdx, 0, remain);
    changeBuffer(buffer);
    tmpBuff.copy(buffer.buffs[buffer.bufferIdx], buffer.writeIdx, remain, tmpBuff.length);
    buffer.writeIdx += tmpBuff.length - remain;
}

module.exports = {
    encode: encode,
    REP_CODE: REP_CODE
}
