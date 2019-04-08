'use strict'
const REPCODE = require('./Encoder.js').REP_CODE

const OLR = [
    {label: "FILE-ID", repcode: REPCODE.ASCII, count: 1},
    {label: "FILE-SET-NAME", repcode: REPCODE.IDENT, count: 1},
    {label: "FILE-SET-NUMBER", repcode: REPCODE.UVARI, count: 1},
    {label: "FILE-NUMBER", repcode: REPCODE.UVARI, count: 1},
    {label: "FILE-TYPE", repcode: REPCODE.IDENT, count: 1},
    {label: "PRODUCT", repcode: REPCODE.ASCII, count: 1},
    {label: "VERSION", repcode: REPCODE.ASCII, count: 1},
    {label: "PROGRAMS", repcode: REPCODE.ASCII},
    {label: "CREATION-TIME", repcode: REPCODE.DTIME, count: 1},
    {label: "ORDER-NUMBER", repcode: REPCODE.ASCII, count: 1},
    {label: "DESCENT-NUMBER"},
    {label: "RUN-NUMBER"},
    {label: "WELL-ID", count: 1},
    {label: "WELL-NAME", repcode: REPCODE.ASCII, count: 1},
    {label: "FIELD-NAME", repcode: REPCODE.ASCII, count: 1},
    {label: "PRODUCER-CODE", repcode: REPCODE.UNORM, count: 1},
    {label: "PRODUCER-NAME", repcode: REPCODE.ASCII, count: 1},
    {label: "COMPANY", repcode: REPCODE.ASCII, count: 1},
    {label: "NAME-SPACE-NAME", repcode: REPCODE.IDENT, count: 1},
    {label: "NAME-SPACE-VERSION", repcode: REPCODE.UVARI, count: 1}
]

const CHANNL = [
    {label: "LONG-NAME", repcode: REPCODE.ASCII, count: 1},
    {label: "PROPERTIES", repcode: REPCODE.IDENT, count: 1},
    {label: "REPRESENTATION-CODE", repcode: REPCODE.USHORT, count: 1},
    {label: "UNITS", repcode: REPCODE.UNITS, count: 1},
    {label: "DIMENSION", repcode: REPCODE.UVARI},
    {label: "AXIS", repcode: REPCODE.OBNAME},
    {label: "ELEMENT-LIMIT", repcode: REPCODE.UVARI},
    {label: "SOURCE", repcode: REPCODE.OBJREF, count: 1}
]

const FRAME = [
    {label: "DESCRIPTION", repcode: REPCODE.ASCII, count: 1},
    {label: "CHANNELS", repcode: REPCODE.OBNAME},
    {label: "INDEX-TYPE", repcode: REPCODE.IDENT, count: 1},
    {label: "DIRECTION", repcode: REPCODE.IDENT, count: 1},
    {label: "SPACING", count: 1},
    {label: "ENCRYPTED", repcode: REPCODE.USHORT, count: 1},
    {label: "INDEX-MIN", count: 1},
    {label: "INDEX-MAX", count: 1}
]

module.exports = {
    OLR: OLR,
    CHANNL: CHANNL,
    FRAME: FRAME
}
