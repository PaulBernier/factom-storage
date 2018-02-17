// 35 (mandatory entry header) + 4 (size of extID) + 2 (part order) + 140 (part signature) 
const HEADER_SIZE = 35 + 2 * 2 + 2 + 140;
const MAX_PARTS_CONTENT_BYTE_SIZE = 10275 - HEADER_SIZE;

// Number of parts == number of Entries
function getNumberOfParts(size) {
    return Math.ceil(size / MAX_PARTS_CONTENT_BYTE_SIZE);
}

// TODO: incorrect I think
function getEcCost(size) {
    // +11 for the chain creation and the header (first entry)
    return 11 + Math.ceil((size + getNumberOfParts(size) * HEADER_SIZE) / 1024);
}

module.exports = {
    MAX_PARTS_CONTENT_BYTE_SIZE,
    getNumberOfParts,
    getEcCost
}