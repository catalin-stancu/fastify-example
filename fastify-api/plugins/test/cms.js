"use strict";

import INDEX from './helpers/index';
import FRISBY from 'frisby';
import QUERY_PARSER from '../../cam/base/lib/query';
import QUERY from '../query';

const EXPECT = INDEX.expect;
const JOI = FRISBY.Joi;
const BASE_URL = INDEX.BASE_URL;

const ENABLE_ALL_TESTS = INDEX.ENABLE_ALL_TESTS;

const INSTANCE_SCHEMA_DATA = {
    uuid: JOI.string().guid({version: ['uuidv4']}).required(),
    first_name: JOI.string().required(),
    last_name: JOI.string().required(),
    email: JOI.string().required(),
    phone: JOI.string().allow(null),
    created: JOI.date().required(),
    modified: JOI.date().required()
};
const INSTANCE_ERROR_MESSAGE = {
    content: JOI.string()
};
const INSTANCE_SCHEMA_ERROR_DATA = {
    statusCode: JOI.number().valid(200, 400, 404, 401),
    name: JOI.string(),
    code: JOI.string().regex(new RegExp('^\\d{3}.\\d{3}.\\d{3}$')),
    type: JOI.number().valid(0, 1, 2),
    details: JOI.array().items(INSTANCE_ERROR_MESSAGE),
    status: JOI.number().valid(200, 400, 404, 401),
    stack: JOI.string()
};
const INSTANCE_SCHEMA_LIST_METADATA = {
    total_items: JOI.number().integer().positive().allow(0),
    end: JOI.boolean(),
    count: JOI.number().integer().positive().allow(0)
};
const INSTANCE_SCHEMA_UPDATE_METADATA = {
    total_items: JOI.number().integer().positive().allow(0),
    count: JOI.number().integer().positive().allow(0),
};
const INSTANCE_SCHEMA_DELETE_METADATA = {
    count: JOI.number().integer().positive().allow(0)
};
const INSTANCE_SCHEMA_ERROR = {
    meta: JOI.object().allow({}),
    messages: JOI.array().items(INSTANCE_SCHEMA_ERROR_DATA),
    data: JOI.object().allow({})
};
const INSTANCE_SCHEMA_ERROR_LIST = {
    meta: JOI.object().allow({}),
    messages: JOI.array().items(INSTANCE_SCHEMA_ERROR_DATA),
    data: JOI.array().allow([])
};
const INSTANCE_SCHEMA = {
    meta: JOI.object().allow({}),
    messages: JOI.array().items(INSTANCE_SCHEMA_ERROR_DATA).allow([]),
    data: INSTANCE_SCHEMA_DATA
};
const INSTANCE_SCHEMA_LIST = {
    meta: INSTANCE_SCHEMA_LIST_METADATA,
    messages: JOI.array().items(INSTANCE_SCHEMA_ERROR_DATA).allow([]),
    data: JOI.array().items(INSTANCE_SCHEMA_DATA).allow([])
};
const INSTANCE_SCHEMA_UPDATE = {
    meta: INSTANCE_SCHEMA_UPDATE_METADATA,
    messages: JOI.array().items(INSTANCE_SCHEMA_ERROR_DATA).allow([]),
    data: JOI.object(INSTANCE_SCHEMA_DATA)
};
const INSTANCE_SCHEMA_UPDATE_LIST = {
    meta: INSTANCE_SCHEMA_UPDATE_METADATA,
    messages: JOI.array().items(INSTANCE_SCHEMA_ERROR_DATA).allow([]),
    data: JOI.array().items(INSTANCE_SCHEMA_DATA).allow([])
};
const INSTANCE_SCHEMA_DELETE = {
    meta: INSTANCE_SCHEMA_DELETE_METADATA,
    messages: JOI.array().items(INSTANCE_SCHEMA_ERROR_DATA).allow([]),
    data: JOI.object().allow({})
};
const INSTANCE_SCHEMA_DELETE_LIST = {
    meta: INSTANCE_SCHEMA_DELETE_METADATA,
    messages: JOI.array().items(INSTANCE_SCHEMA_ERROR_DATA).allow([]),
    data: JOI.object().allow({})
};

function _getRandomIntBetween(low = 0, high = 10) {
    return Math.floor(Math.random() * (1 + high - low) + low);
}

function _makeGetRandomElementFromList(list) {
    if (!list?.length) {
        throw new Error('list can be only an array or string, and cannot be falsy or undefined');
    }
    
    return () => {
        let randomIndex = _getRandomIntBetween(0, list.length - 1);
        return list[randomIndex];
    };
};

const VALID_WEIGHTED_LETTERS = 'aaaaaabcdeeeeeeeeeefghiiiiiiiiiiijklmnoooooooooopqrstuuuuuuuuuuuuvwxyzăîâșț\'--      ';
let _getRandomLetter = _makeGetRandomElementFromList(VALID_WEIGHTED_LETTERS);

const VALID_BASIC_LETTERS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!#$%&\'*+-/=?^_`{|}~';
let _getRandomBasicLetter = _makeGetRandomElementFromList(VALID_BASIC_LETTERS);

let _getRandomLetters = (count = 5, basic = false) => {
    let letters = [];
    for (let i = 1; i <= count; i++) {
        let newLetter = basic ? _getRandomBasicLetter() : _getRandomLetter();
        letters.push(newLetter);
    }
    return letters.join('');
};

let _generateSampleData = (extra = {}) => {
    let first_name = `${_getRandomLetter().toUpperCase()}${_getRandomLetters(8)}`;
    let last_name = `${_getRandomLetter().toUpperCase()}${_getRandomLetters(8)}`;

    return {
        first_name,
        last_name,
        email: `${_getRandomLetters(8, true)}${_getRandomIntBetween(1, 99)}@rol.ro`,
        phone: `07${_getRandomIntBetween(0, 99999999).toString().padStart(8, '0')}`,
        ...extra
    };
};

let _deleteExtraSamples = async (uuids = []) => {
    if (uuids.length === 0) return false;
    const RESULTS = await FRISBY.delete(`${BASE_URL}/customers/?${QUERY.serializeToQuerystring({
        uuid: {
            $in: uuids
        }
    })}&transactionId=f5934803-aa2b-4c21-acfa-b2386ca0e5de`)
        .expect('status', 200)
        .expect('jsonTypes', INSTANCE_SCHEMA_DELETE_LIST);
    EXPECT(RESULTS.json.messages).to.be.undefined;
    return RESULTS.json.data;
};

function _expectErrorWithCode(response, errorCode, classCode = '000') {
    let data = response?.json?.data;
    let meta = response?.json?.meta;
    let messages = response?.json?.messages;

    EXPECT(messages).to.not.be.empty;
    EXPECT(meta).to.be.undefined;
    EXPECT(data).to.be.undefined;
    EXPECT(messages).to.have.length(1);
    EXPECT(messages[0].code).to.equal(`005.${classCode}.${errorCode}`); 
}

const VALID_COLUMNS_LIST = ['uuid', 'first_name','last_name','email', 'phone', 'created','modified'];

// Replace groupings characters () and [] with actual delimiters
function _prepareQueryTestURL(...paramsList) {
    if (!paramsList) return null;

    let searchString = paramsList
        .join('&')
        .replace(/\(/g, QUERY_PARSER.EXPRESSION_DELIM_START_CHAR)
        .replace(/\)/g, QUERY_PARSER.EXPRESSION_DELIM_END_CHAR)
        .replace(/\[/g, QUERY_PARSER.ID_DELIM_START_CHAR)
        .replace(/\]/g, QUERY_PARSER.ID_DELIM_END_CHAR)
        .replace(/ord/g, QUERY_PARSER.ORDER_PARAM_PREFIX)
        .replace(/fld/g, QUERY_PARSER.FIELD_PARAM_PREFIX);

    return `${BASE_URL}/customers?${searchString}`;
}

let sample_1 = {};
describe('Any module endpoints', () => {
    before(async () => {
        
    });
    // before each test create a sample instance to work with
    beforeEach(async () => {
        if (!ENABLE_ALL_TESTS) return false;

        let response = await FRISBY.post(`${BASE_URL}/customers?transactionId=f5934803-aa2b-4c21-acfa-b2386ca0e5de`, {
            data: _generateSampleData()
        }, {json: true})
            .expect('status', 200);

        EXPECT(response.json.messages).to.be.undefined;
        sample_1 = response.json.data;
    });
    // after each test remove the sample instance previously created
    afterEach(async () => {
        if (!ENABLE_ALL_TESTS) return false;

        let response = await FRISBY.delete(`${BASE_URL}/customers/${sample_1.uuid}?transactionId=f5934803-aa2b-4c21-acfa-b2386ca0e5de`)
            .expect('status', 200)
            .expect('jsonTypes', INSTANCE_SCHEMA_DELETE);

        EXPECT(response.json.messages).to.be.undefined;
    });
    after(async () => {

    });

    // here you can copy-paste wanted unit tests for easier debugging
    // set flag ENABLE_ALL_TESTS=false to activate this scope
    if (!ENABLE_ALL_TESTS)
        describe('Manual testing of unit-tests', () => {

        });
    if (ENABLE_ALL_TESTS)
        describe('ANY /ANY', () => {
            describe('/Optional query parameter transactionId handling', () => {
                it('Should return "200 OK" success response, valid transactionId', async () => {
                    let response = await FRISBY.get(`${BASE_URL}/customers/${sample_1.uuid}?transactionId=f5934803-aa2b-4c21-acfa-b2386ca0e5de`)
                        .expect('status', 200)
                        .expect('jsonTypes', INSTANCE_SCHEMA);
                    EXPECT(response.json.messages).to.be.undefined;
                    EXPECT(response.json.data.uuid).to.equal(sample_1.uuid);
                });

                it('Should return "400 Bad Request" error response, invalid transactionId', async () => {
                    let response = await FRISBY.get(`${BASE_URL}/customers/${sample_1.uuid}?transactionId=wrong`)
                        .expect('status', 400)
                        .expect('jsonTypes', INSTANCE_SCHEMA_ERROR);
                });

                it('Should return "200 OK" success response, missing transactionId', async () => {
                    let response = await FRISBY.get(`${BASE_URL}/customers/${sample_1.uuid}`)
                        .expect('status', 200)
                        .expect('jsonTypes', INSTANCE_SCHEMA);
                    let tId1 = response.headers.get('x-transaction-id');
                    EXPECT(tId1).to.not.be.undefined;
                    EXPECT(tId1).to.have.length(36);

                    response = await FRISBY.get(`${BASE_URL}/customers/${sample_1.uuid}`)
                        .expect('status', 200)
                        .expect('jsonTypes', INSTANCE_SCHEMA);
                    let tId2 = response.headers.get('x-transaction-id');
                    EXPECT(tId2).to.not.be.undefined;
                    EXPECT(tId2).to.have.length(36);

                    EXPECT(tId2).to.not.be.equal(tId1);
                });
            });
        });

    if (ENABLE_ALL_TESTS)
        describe('/Caching', () => {
            // TODO: Enable this after we have other instance types as well
            it.skip('Should return "200 OK" success response, data is stored correctly and list queries discriminate between different resources', async () => {
                // Create second customer item
                let response = await FRISBY.post(`${BASE_URL}/customers?transactionId=f5934803-aa2b-4c21-acfa-b2386ca0e5de`, {
                    data: _generateSampleData()
                }, {json: true})
                    .expect('status', 200)
                    .expect('jsonTypes', INSTANCE_SCHEMA);

                EXPECT(response.json.messages).to.be.undefined;
                let sample_2 = response.json.data;

                // Retrieve a list with customer instances
                let queryValue = JSON.stringify({
                    uuid: [sample_1.uuid, sample_2.uuid]
                });

                response = await FRISBY.get(`${BASE_URL}/customers?where=${queryValue}&limit=2&offset=0&order=${JSON.stringify([
                    ['created', 'ASC']
                ])}&transactionId=f5934803-aa2b-4c21-acfa-b2386ca0e5de`)
                    .expect('status', 200)
                    .expect('jsonTypes', INSTANCE_SCHEMA_LIST);
                let addressElement = response.json.data[0];
                let meta = response.json.meta;

                EXPECT(response.json.messages).to.be.undefined;
                EXPECT(meta.count).to.equal(1);
                EXPECT(meta.end).to.equal(true);
                EXPECT(addressElement.uuid).to.equal(sample_1.uuid);

                // Retrieve a list with file instances, with the same query as the first line
                response = await FRISBY.get(`${BASE_URL}/files?where=${queryValue}&limit=2&offset=0&order=${JSON.stringify([
                    ['created', 'ASC']
                ])}&transactionId=f5934803-aa2b-4c21-acfa-b2386ca0e5de`)
                    .expect('status', 200)
                    .expect('jsonTypes', INSTANCE_SCHEMA_LIST);
                let blockElement = response.json.data[0];
                meta = response.json.meta;

                EXPECT(response.json.messages).to.be.undefined;
                EXPECT(meta.count).to.equal(1);
                EXPECT(meta.end).to.equal(true);
                EXPECT(blockElement.uuid).to.equal(sample_2.uuid);

                // Check if the lists are discriminated correctly even though they have the same query params,
                // The contents of the list should be different, including the first element's uuids
                EXPECT(addressElement.uuid).to.not.equal(blockElement.uuid);

                await _deleteExtraSamples([
                    sample_2.uuid
                ]);
            });

            it('Should return "200 OK" success response, data is refreshed correctly when items are updated individually', async () => {
                // Get customer instance
                let response = await FRISBY.get(`${BASE_URL}/customers/${sample_1.uuid}?transactionId=f5934803-aa2b-4c21-acfa-b2386ca0e5de`)
                    .expect('status', 200)
                    .expect('jsonTypes', INSTANCE_SCHEMA);
                EXPECT(response.json.data.uuid).to.equal(sample_1.uuid);

                // Then update it
                const SAMPLE_DATA = _generateSampleData({
                    first_name: 'new',
                });

                response = await FRISBY.patch(`${BASE_URL}/customers/${sample_1.uuid}?transactionId=f5934803-aa2b-4c21-acfa-b2386ca0e5de`, {
                    data: SAMPLE_DATA
                }, {json: true})
                    .expect('status', 200)
                    .expect('jsonTypes', INSTANCE_SCHEMA_UPDATE);
                EXPECT(response.json.messages).to.be.undefined;

                // Get customer instance again after update
                let secondResponse = await FRISBY.get(`${BASE_URL}/customers/${sample_1.uuid}?transactionId=f5934803-aa2b-4c21-acfa-b2386ca0e5de`)
                    .expect('status', 200)
                    .expect('jsonTypes', INSTANCE_SCHEMA);
                EXPECT(secondResponse.json.messages).to.be.undefined;
                let dataRecheck = secondResponse.json.data;

                // Check the read value is equal with the value used for update
                EXPECT(dataRecheck.uuid).to.be.equal(sample_1.uuid);
                EXPECT(dataRecheck.first_name).to.equal(SAMPLE_DATA.first_name);
            });

            it('Should return "404 Not Found" error response, items are not stored after they are deleted individually', async () => {
                // Get customer instance
                let response = await FRISBY.get(`${BASE_URL}/customers/${sample_1.uuid}?transactionId=f5934803-aa2b-4c21-acfa-b2386ca0e5de`)
                    .expect('status', 200)
                    .expect('jsonTypes', INSTANCE_SCHEMA);

                EXPECT(response.json.messages).to.be.undefined;
                EXPECT(response.json.data.uuid).to.equal(sample_1.uuid);

                // Delete it and check it succeeded
                response = await FRISBY.delete(`${BASE_URL}/customers/${sample_1.uuid}?transactionId=f5934803-aa2b-4c21-acfa-b2386ca0e5de`)
                    .expect('status', 200)
                    .expect('jsonTypes', INSTANCE_SCHEMA_DELETE);
                let meta = response.json.meta;

                EXPECT(response.json.messages).to.be.undefined;
                EXPECT(meta.count).to.equal(1);

                // If we request the same instance again we should not be able to find it
                response = await FRISBY.get(`${BASE_URL}/customers/${sample_1.uuid}?transactionId=f5934803-aa2b-4c21-acfa-b2386ca0e5de`)
                    .expect('status', 404)
                    .expect('jsonTypes', INSTANCE_SCHEMA_ERROR);

                EXPECT(response.json.messages).to.have.lengthOf(1);
            });

            it('Should return "200 OK" success response, data for lists is refreshed when a containing item is updated individually', async () => {
                // Create second customer item
                let response = await FRISBY.post(`${BASE_URL}/customers?transactionId=f5934803-aa2b-4c21-acfa-b2386ca0e5de`, {
                    data: _generateSampleData()
                }, {json: true})
                    .expect('status', 200);
                EXPECT(response.json.messages).to.be.undefined;
                let sample_2 = response.json.data;

                // Retrieve list with the previously created customers
                let query = QUERY.serializeToQuerystring({
                    uuid: {
                        '$in': [sample_1.uuid, sample_2.uuid]
                    }
                }, [['created', 'ASC']]);

                response = await FRISBY.get(`${BASE_URL}/customers?${query}&limit=2&offset=0&transactionId=f5934803-aa2b-4c21-acfa-b2386ca0e5de`)
                    .expect('status', 200)
                    .expect('jsonTypes', INSTANCE_SCHEMA_LIST);
                let list = response.json.data;
                let meta = response.json.meta;

                EXPECT(meta.count).to.equal(2);
                EXPECT(meta.end).to.equal(true);
                EXPECT(list[0].uuid).to.equal(sample_1.uuid);
                EXPECT(list[1].uuid).to.equal(sample_2.uuid);

                // Then update the first customer in the list
                const SAMPLE_DATA = _generateSampleData({
                    first_name: 'new',
                });

                response = await FRISBY.patch(`${BASE_URL}/customers/${sample_1.uuid}?transactionId=f5934803-aa2b-4c21-acfa-b2386ca0e5de`, {
                    data: SAMPLE_DATA
                }, {json: true})
                    .expect('status', 200)
                    .expect('jsonTypes', INSTANCE_SCHEMA_UPDATE);
                EXPECT(response.json.messages).to.be.undefined;

                // Retrieve list with the customer instances after the update
                response = await FRISBY.get(`${BASE_URL}/customers?${query}&limit=2&offset=0&transactionId=f5934803-aa2b-4c21-acfa-b2386ca0e5de`)
                    .expect('status', 200)
                    .expect('jsonTypes', INSTANCE_SCHEMA_LIST);
                let listUpdated = response.json.data;
                meta = response.json.meta;

                EXPECT(meta.count).to.equal(2);
                EXPECT(meta.end).to.equal(true);

                let firstAddress = listUpdated[0];
                let secondAddress = listUpdated[1];

                // Check that the first customer was updated correctly and the second one remained unchanged
                EXPECT(firstAddress.uuid).to.be.equal(sample_1.uuid);
                EXPECT(firstAddress.first_name).to.equal(SAMPLE_DATA.first_name);

                EXPECT(secondAddress).to.be.an('object').deep.equal(list[1]);

                await _deleteExtraSamples([
                    sample_2.uuid
                ]);
            });

            it('Should return "200 OK" success response, data is refreshed correctly when a new customer is created', async () => {
                // Create second customer item
                let response = await FRISBY.post(`${BASE_URL}/customers?transactionId=f5934803-aa2b-4c21-acfa-b2386ca0e5de`, {
                    data: _generateSampleData()
                }, {json: true})
                    .expect('status', 200);
                EXPECT(response.json.messages).to.be.undefined;
                let sample_2 = response.json.data;

                // Get customer instance after creation and check it is equal to the created value
                let secondResponse = await FRISBY.get(`${BASE_URL}/customers/${sample_2.uuid}?transactionId=f5934803-aa2b-4c21-acfa-b2386ca0e5de`)
                    .expect('status', 200)
                    .expect('jsonTypes', INSTANCE_SCHEMA);

                EXPECT(secondResponse.json.messages).to.be.undefined;
                let dataRecheck = secondResponse.json.data;
                EXPECT(dataRecheck.uuid).to.be.equal(sample_2.uuid);
                EXPECT(dataRecheck.first_name).to.equal(sample_2.first_name);

                // Retrieve list with the previously created customers
                let query = QUERY.serializeToQuerystring({
                    uuid: {
                        '$in': [sample_1.uuid, sample_2.uuid]
                    }
                }, [['created', 'ASC']]);

                response = await FRISBY.get(`${BASE_URL}/customers?${query}&limit=2&offset=0&transactionId=f5934803-aa2b-4c21-acfa-b2386ca0e5de`)
                    .expect('status', 200)
                    .expect('jsonTypes', INSTANCE_SCHEMA_LIST);
                let list = response.json.data;
                let meta = response.json.meta;

                EXPECT(meta.count).to.equal(2);
                EXPECT(meta.end).to.equal(true);
                EXPECT(list[0].uuid).to.equal(sample_1.uuid);
                EXPECT(list[1].uuid).to.equal(sample_2.uuid);

                // Create third customer item
                response = await FRISBY.post(`${BASE_URL}/customers?transactionId=f5934803-aa2b-4c21-acfa-b2386ca0e5de`, {
                    data: _generateSampleData()
                }, {json: true})
                    .expect('status', 200);
                EXPECT(response.json.messages).to.be.undefined;
                let sample_3 = response.json.data;

                // Retrieve list with the previously three created customer instances
                query = QUERY.serializeToQuerystring({
                    uuid: {
                        '$in': [sample_1.uuid, sample_2.uuid, sample_3.uuid]
                    }
                }, [['created', 'ASC']]);

                response = await FRISBY.get(`${BASE_URL}/customers?${query}&limit=3&offset=0&transactionId=f5934803-aa2b-4c21-acfa-b2386ca0e5de`)
                    .expect('status', 200)
                    .expect('jsonTypes', INSTANCE_SCHEMA_LIST);
                let updatedList = response.json.data;
                meta = response.json.meta;

                // Check initial unmodified entities are found with their initial values in the updated list
                EXPECT(meta.count).to.equal(3);
                EXPECT(meta.end).to.equal(true);
                EXPECT(updatedList[0]).to.deep.equal(list[0]);
                EXPECT(updatedList[1]).to.deep.equal(list[1]);

                // Check the newly created customer is found in the updated list with correct values
                EXPECT(updatedList[2].uuid).to.be.equal(sample_3.uuid);
                EXPECT(updatedList[2].first_name).to.equal(sample_3.first_name);

                await _deleteExtraSamples([
                    sample_2.uuid, sample_3.uuid
                ]);
            });

            it('Should return "200 OK" success response, data for lists is refreshed correctly when a containing item is deleted', async () => {
                // Create second customer item
                const SAMPLE_DATA = _generateSampleData();
                let response = await FRISBY.post(`${BASE_URL}/customers?transactionId=f5934803-aa2b-4c21-acfa-b2386ca0e5de`, {
                    data: SAMPLE_DATA
                }, {json: true})
                    .expect('status', 200);
                EXPECT(response.json.messages).to.be.undefined;
                let sample_2 = response.json.data;

                // Retrieve list with the previously created customer instances
                let query = QUERY.serializeToQuerystring({
                    uuid: {
                        '$in': [sample_1.uuid, sample_2.uuid]
                    }
                }, [['created', 'ASC']]);

                response = await FRISBY.get(`${BASE_URL}/customers?${query}&limit=2&offset=0&transactionId=f5934803-aa2b-4c21-acfa-b2386ca0e5de`)
                    .expect('status', 200)
                    .expect('jsonTypes', INSTANCE_SCHEMA_LIST);
                let list = response.json.data;
                let meta = response.json.meta;

                EXPECT(meta.count).to.equal(2);
                EXPECT(meta.end).to.equal(true);
                EXPECT(list[0].uuid).to.equal(sample_1.uuid);
                EXPECT(list[1].uuid).to.equal(sample_2.uuid);

                // Delete the second customer item and check it succeeded
                response = await FRISBY.delete(`${BASE_URL}/customers/${sample_2.uuid}?transactionId=f5934803-aa2b-4c21-acfa-b2386ca0e5de`)
                    .expect('status', 200)
                    .expect('jsonTypes', INSTANCE_SCHEMA_DELETE);
                meta = response.json.meta;

                EXPECT(response.json.messages).to.be.undefined;
                EXPECT(meta.count).to.equal(1);

                // Retrieve list with customer instances again
                response = await FRISBY.get(`${BASE_URL}/customers?${query}&limit=2&offset=0&transactionId=f5934803-aa2b-4c21-acfa-b2386ca0e5de`)
                    .expect('status', 200)
                    .expect('jsonTypes', INSTANCE_SCHEMA_LIST);
                let data = response.json.data;
                meta = response.json.meta;

                EXPECT(meta.count).to.equal(1);
                EXPECT(meta.end).to.equal(true);

                let firstAddress = data[0];
                let secondAddress = data[1];

                // Check that the unmodified customer was kept unchanged and that the second one was deleted
                EXPECT(firstAddress.uuid).to.be.equal(sample_1.uuid);
                EXPECT(firstAddress.first_name).to.equal(sample_1.first_name);

                EXPECT(secondAddress).to.be.undefined;
            });

            it('Should return "200 OK" success response, data for lists and items in lists is refreshed correctly when items are updated via an update query', async () => {
                // Create second customer item
                let response = await FRISBY.post(`${BASE_URL}/customers?transactionId=f5934803-aa2b-4c21-acfa-b2386ca0e5de`, {
                    data: _generateSampleData()
                }, {json: true})
                    .expect('status', 200);
                EXPECT(response.json.messages).to.be.undefined;
                let sample_2 = response.json.data;

                // Retrieve list with the previously created customer instances
                let query = QUERY.serializeToQuerystring({
                    uuid: {
                        '$in': [sample_1.uuid, sample_2.uuid]
                    }
                }, [['created', 'ASC']]);

                response = await FRISBY.get(`${BASE_URL}/customers?${query}&limit=2&offset=0&transactionId=f5934803-aa2b-4c21-acfa-b2386ca0e5de`)
                    .expect('status', 200)
                    .expect('jsonTypes', INSTANCE_SCHEMA_LIST);
                let list = response.json.data;
                let meta = response.json.meta;

                EXPECT(meta.count).to.equal(2);
                EXPECT(meta.end).to.equal(true);
                EXPECT(list[0].uuid).to.equal(sample_1.uuid);
                EXPECT(list[1].uuid).to.equal(sample_2.uuid);

                // Then update the first customer in the list using an update query
                const SAMPLE_DATA = _generateSampleData();

                response = await FRISBY.patch(`${BASE_URL}/customers?${QUERY.serializeToQuerystring({
                    uuid: {
                        '$eq': sample_1.uuid
                    }
                })}&transactionId=f5934803-aa2b-4c21-acfa-b2386ca0e5de`, {
                    data: SAMPLE_DATA
                }, {json: true})
                    .expect('status', 200)
                    .expect('jsonTypes', INSTANCE_SCHEMA_UPDATE_LIST);
                EXPECT(response.json.messages).to.be.undefined;
                meta = response.json.meta;
                EXPECT(meta.count).to.equal(1);

                // Retrieve the list of entities again with the updated value
                response = await FRISBY.get(`${BASE_URL}/customers?${query}&limit=2&offset=0&transactionId=f5934803-aa2b-4c21-acfa-b2386ca0e5de`)
                    .expect('status', 200)
                    .expect('jsonTypes', INSTANCE_SCHEMA_LIST);
                let listUpdated = response.json.data;
                meta = response.json.meta;

                EXPECT(meta.count).to.equal(2);
                EXPECT(meta.end).to.equal(true);

                let firstAddress = listUpdated[0];
                let secondAddress = listUpdated[1];

                // In a batch update we don't update the first_name
                EXPECT(firstAddress.first_name).to.equal(sample_1.first_name);

                // Check the first customer was modified correctly
                EXPECT(firstAddress.uuid).to.be.equal(sample_1.uuid);
                EXPECT(firstAddress.phone).to.equal(SAMPLE_DATA.phone);

                // Check the second customer hasn't changed
                EXPECT(secondAddress).to.be.an('object').deep.equal(list[1]);

                await _deleteExtraSamples([
                    sample_2.uuid
                ]);
            });

            it('Should return "200 OK" success response, data for lists and items in lists is refreshed correctly when items are deleted via a delete query', async () => {
                // Create second customer item
                let response = await FRISBY.post(`${BASE_URL}/customers?transactionId=f5934803-aa2b-4c21-acfa-b2386ca0e5de`, {
                    data: _generateSampleData()
                }, {json: true})
                    .expect('status', 200);
                EXPECT(response.json.messages).to.be.undefined;
                let sample_2 = response.json.data;

                // Retrieve list with the previously created customer instances
                let query = QUERY.serializeToQuerystring({
                    uuid: {
                        '$in': [sample_1.uuid, sample_2.uuid]
                    }
                }, [['created', 'ASC']]);

                response = await FRISBY.get(`${BASE_URL}/customers?${query}&limit=2&offset=0&transactionId=f5934803-aa2b-4c21-acfa-b2386ca0e5de`)
                    .expect('status', 200)
                    .expect('jsonTypes', INSTANCE_SCHEMA_LIST);
                let list = response.json.data;
                let meta = response.json.meta;

                EXPECT(meta.count).to.equal(2);
                EXPECT(meta.end).to.equal(true);
                EXPECT(list[0].uuid).to.equal(sample_1.uuid);
                EXPECT(list[1].uuid).to.equal(sample_2.uuid);

                // Then delete the second customer in the list using a delete query
                response = await FRISBY.delete(`${BASE_URL}/customers?${QUERY.serializeToQuerystring({
                    uuid: {
                        '$eq': sample_2.uuid
                    }
                })}&transactionId=f5934803-aa2b-4c21-acfa-b2386ca0e5de`)
                    .expect('status', 200)
                    .expect('jsonTypes', INSTANCE_SCHEMA_DELETE_LIST);
                meta = response.json.meta;

                EXPECT(response.json.messages).to.be.undefined;
                EXPECT(meta.count).to.equal(1);

                // Retrieve the list with customer instances again
                response = await FRISBY.get(`${BASE_URL}/customers?${query}&limit=2&offset=0&transactionId=f5934803-aa2b-4c21-acfa-b2386ca0e5de`)
                    .expect('status', 200)
                    .expect('jsonTypes', INSTANCE_SCHEMA_LIST);
                list = response.json.data;
                meta = response.json.meta;

                EXPECT(meta.count).to.equal(1);
                EXPECT(meta.end).to.equal(true);

                let firstAddress = list[0];
                let secondAddress = list[1];

                // Check the first customer was not modified
                EXPECT(firstAddress.uuid).to.be.equal(sample_1.uuid);
                EXPECT(firstAddress.first_name).to.equal(sample_1.first_name);

                // Check the second customer was deleted
                EXPECT(secondAddress).to.be.undefined;
            });
        });

    if (ENABLE_ALL_TESTS)
        describe('Query Parsing', () => {
            describe('Manual white-box tests', () => {
                it('Should parse query correctly, no query filter or order, returns all items', async () => {
                    let input = `${BASE_URL}/banners`;
                    let inputQuerystringMap = new URL(input).searchParams;
                    let params = Object.fromEntries(inputQuerystringMap.entries());

                    let startTime = process.hrtime.bigint();
                    let {
                        queryObject,
                        orderBy
                    } = QUERY_PARSER.deserializeFromQuerystring(
                        params,
                        ['first_name', 'age', 'last_name', 'city', 'created'],
                        ['first_name', 'age', 'last_name', 'city', 'created']
                    );
                    let endTime = process.hrtime.bigint();
                    let totalTimeMs = +(Number(endTime - startTime) / 1e6).toFixed(2);

                    EXPECT(queryObject, 'query expression in ORM form').to.be.null;
                    EXPECT(orderBy, 'order by').to.be.deep.equal([]);
                    EXPECT(totalTimeMs, 'total time').to.be.lessThan(2);

                    let reconstructedInputQuerystring = QUERY.serializeToQuerystring(queryObject, orderBy);
                    let inputQuerystring = new URL(input).search.replace(/^\?/, '');
                    EXPECT(reconstructedInputQuerystring, 'reconstructed input').to.equal(inputQuerystring);
                });

                it('Should parse query correctly, query with single operand', async () => {
                    let input = _prepareQueryTestURL(`fld[age][gt][1]=60&ops=([1])`);
                    let inputQuerystringMap = new URL(input).searchParams;
                    let params = Object.fromEntries(inputQuerystringMap.entries());

                    let startTime = process.hrtime.bigint();
                    let {
                        queryObject,
                        orderBy
                    } = QUERY_PARSER.deserializeFromQuerystring(
                        params,
                        ['first_name', 'age', 'last_name', 'city', 'created'],
                        ['first_name', 'age', 'last_name', 'city', 'created']
                    );
                    let endTime = process.hrtime.bigint();
                    let totalTimeMs = +(Number(endTime - startTime) / 1e6).toFixed(2);

                    EXPECT(queryObject, 'query expression in ORM form').to.be.deep.equal({
                        age: {
                            '$gt': '60',
                        }
                    });
                    EXPECT(orderBy, 'order by').to.be.deep.equal([]);
                    EXPECT(totalTimeMs, 'total time').to.be.lessThan(2);
                });

                it('Should parse query correctly, query with one field and no operand expression is parsed as simple field expression', async () => {
                    let input = _prepareQueryTestURL(`fld[age][gt][1]=60`);
                    let inputQuerystringMap = new URL(input).searchParams;
                    let params = Object.fromEntries(inputQuerystringMap.entries());

                    let startTime = process.hrtime.bigint();
                    let {
                        queryObject,
                        orderBy
                    } = QUERY_PARSER.deserializeFromQuerystring(
                        params,
                        ['first_name', 'age', 'last_name', 'city', 'created'],
                        ['first_name', 'age', 'last_name', 'city', 'created']
                    );
                    let endTime = process.hrtime.bigint();
                    let totalTimeMs = +(Number(endTime - startTime) / 1e6).toFixed(2);

                    EXPECT(queryObject, 'query expression in ORM form').to.be.deep.equal({
                        age: {
                            '$gt': '60',
                        }
                    });
                    EXPECT(orderBy, 'order by').to.be.deep.equal([]);
                    EXPECT(totalTimeMs, 'total time').to.be.lessThan(2);

                    let reconstructedInputQuerystring = QUERY.serializeToQuerystring(queryObject, orderBy);
                    let inputQuerystring = new URL(input).search.replace(/^\?/, '');
                    EXPECT(reconstructedInputQuerystring, 'reconstructed input').to.equal(inputQuerystring);
                });

                it('Should parse query correctly, order params are parsed correctly, no query is given', async () => {
                    let input = _prepareQueryTestURL(`ord[age]=asc`);
                    let inputQuerystringMap = new URL(input).searchParams;
                    let params = Object.fromEntries(inputQuerystringMap.entries());

                    let startTime = process.hrtime.bigint();
                    let {
                        queryObject,
                        orderBy
                    } = QUERY_PARSER.deserializeFromQuerystring(
                        params,
                        ['first_name', 'age', 'last_name', 'city', 'created'],
                        ['first_name', 'age', 'last_name', 'city', 'created']
                    );
                    let endTime = process.hrtime.bigint();
                    let totalTimeMs = +(Number(endTime - startTime) / 1e6).toFixed(2);

                    EXPECT(queryObject, 'query expression in ORM form').to.be.null;
                    EXPECT(orderBy, 'order by').to.be.deep.equal([['age', 'ASC']]);
                    EXPECT(totalTimeMs, 'total time').to.be.lessThan(2);

                    let reconstructedInputQuerystring = QUERY.serializeToQuerystring(queryObject, orderBy);
                    let inputQuerystring = new URL(input).search.replace(/^\?/, '');
                    EXPECT(reconstructedInputQuerystring, 'reconstructed input').to.equal(inputQuerystring);
                });

                it('Should parse query correctly, query with basic operand expression, including order', async () => {
                    let input = _prepareQueryTestURL(
                        'fld[age12][gt][1]=60',
                        'fld[age][lt][2]=70',
                        'ops=([2])OR([1])',
                        'ord[first_name]=asc',
                        'ord[age]=desc'
                    );
                    let inputQuerystringMap = new URL(input).searchParams;
                    let params = Object.fromEntries(inputQuerystringMap.entries());

                    let startTime = process.hrtime.bigint();
                    let {
                        queryObject,
                        orderBy
                    } = QUERY_PARSER.deserializeFromQuerystring(
                        params,
                        ['first_name', 'age', 'age12', 'city', 'created'],
                        ['first_name', 'age', 'age12', 'city', 'created']
                    );
                    let endTime = process.hrtime.bigint();
                    let totalTimeMs = +(Number(endTime - startTime) / 1e6).toFixed(2);

                    EXPECT(queryObject, 'query expression in ORM form').to.be.deep.equal({
                        '$or': [
                            {
                                age: {
                                    '$lt': '70',
                                }
                            },
                            {
                                age12: {
                                    '$gt': '60',
                                }
                            }
                        ]
                    });
                    EXPECT(orderBy, 'order by').to.be.deep.equal([['first_name', 'ASC'], ['age', 'DESC']]);
                    EXPECT(totalTimeMs, 'total time').to.be.lessThan(2);
                });

                it('Should parse query correctly, query with several fields without ids (sub-expressions) and no ops expression performs implicit AND', async () => {
                    let input = _prepareQueryTestURL(
                        'fld[age][lt]=70',
                        'fld[zip][gt]=60'
                    );
                    let inputQuerystringMap = new URL(input).searchParams;
                    let params = Object.fromEntries(inputQuerystringMap.entries());

                    let startTime = process.hrtime.bigint();
                    let {
                        queryObject,
                        orderBy
                    } = QUERY_PARSER.deserializeFromQuerystring(
                        params,
                        ['name', 'age', 'age12', 'city', 'zip'],
                        ['name', 'age', 'age12', 'city', 'zip']
                    );
                    let endTime = process.hrtime.bigint();
                    let totalTimeMs = +(Number(endTime - startTime) / 1e6).toFixed(2);

                    EXPECT(queryObject, 'query expression in ORM form').to.be.deep.equal({
                        '$and': [
                            {
                                age: {
                                    '$lt': '70',
                                }
                            },
                            {
                                zip: {
                                    '$gt': '60',
                                }
                            }
                        ]
                    });
                    EXPECT(orderBy, 'order by').to.be.deep.equal([]);
                    EXPECT(totalTimeMs, 'total time').to.be.lessThan(2);
                });

                it('Should parse query correctly, query with basic operand expression, including order, field parameters that are not used in the operand expression are ignored', async () => {
                    let input = _prepareQueryTestURL(
                        'fld[age][lt][0]=70',
                        'fld[age][gt][1]=60',
                        'fld[last_name][in][2]=sonia,george',
                        'ops=([1]AND[2])',
                        'ord[first_name]=asc'
                    );
                    let inputQuerystringMap = new URL(input).searchParams;
                    let params = Object.fromEntries(inputQuerystringMap.entries());

                    let startTime = process.hrtime.bigint();
                    let {
                        queryObject,
                        orderBy
                    } = QUERY_PARSER.deserializeFromQuerystring(
                        params,
                        ['first_name', 'age', 'last_name', 'city', 'created'],
                        ['first_name', 'age', 'last_name', 'city', 'created']
                    );
                    let endTime = process.hrtime.bigint();
                    let totalTimeMs = +(Number(endTime - startTime) / 1e6).toFixed(2);

                    EXPECT(queryObject, 'query expression in ORM form').to.be.deep.equal({
                        '$and': [
                            {
                                age: {
                                    '$gt': '60',
                                }
                            },
                            {
                                last_name: {
                                    '$in': ['sonia', 'george']
                                }
                            }
                        ]
                    });
                    EXPECT(orderBy, 'order by').to.be.deep.equal([['first_name', 'ASC']]);
                    EXPECT(totalTimeMs, 'total time').to.be.lessThan(2);
                });

                it('Should parse query correctly, query with a field parameter that uses the "in" operator with a list of allowed values', async () => {
                    let input = _prepareQueryTestURL(
                        'fld[age][in][1]=11',
                        'fld[last_name][in][2]=sonia,george',
                        'ops=([1]AND[2])'
                    );
                    let inputQuerystringMap = new URL(input).searchParams;
                    let params = Object.fromEntries(inputQuerystringMap.entries());

                    let startTime = process.hrtime.bigint();
                    let {
                        queryObject,
                        orderBy
                    } = QUERY_PARSER.deserializeFromQuerystring(
                        params,
                        ['first_name', 'age', 'last_name', 'city', 'created'],
                        ['first_name', 'age', 'last_name', 'city', 'created']
                    );
                    let endTime = process.hrtime.bigint();
                    let totalTimeMs = +(Number(endTime - startTime) / 1e6).toFixed(2);

                    EXPECT(queryObject, 'query expression in ORM form').to.be.deep.equal({
                        '$and': [
                            {
                                age: {
                                    '$in': ['11'],
                                }
                            },
                            {
                                last_name: {
                                    '$in': ['sonia', 'george']
                                }
                            }
                        ]
                    });
                    EXPECT(orderBy, 'order by').to.be.deep.equal([]);
                    EXPECT(totalTimeMs, 'total time').to.be.lessThan(2);

                    let reconstructedInputQuerystring = QUERY.serializeToQuerystring(queryObject, orderBy);
                    let inputQuerystring = new URL(input).search.replace(/^\?/, '');
                    EXPECT(reconstructedInputQuerystring, 'reconstructed input').to.equal(inputQuerystring);
                });

                it('Should parse query correctly, query with operand expression made of multiple groups with binary operations', async () => {
                    let input = _prepareQueryTestURL(
                        'fld[first_name][like][1]=escu',
                        'fld[age][gt][2]=60',
                        'fld[last_name][in][3]=sonia',
                        'fld[city][eq][4]=Cluj',
                        'ops=([1]AND[2])OR([3]AND[4])',
                        'ord[created]=asc',
                        'ord[age]=asc'
                    );
                    let inputQuerystringMap = new URL(input).searchParams;
                    let params = Object.fromEntries(inputQuerystringMap.entries());

                    let startTime = process.hrtime.bigint();
                    let {
                        queryObject,
                        orderBy
                    } = QUERY_PARSER.deserializeFromQuerystring(
                        params,
                        ['first_name', 'age', 'last_name', 'city', 'created'],
                        ['first_name', 'age', 'last_name', 'city', 'created']
                    );
                    let endTime = process.hrtime.bigint();
                    let totalTimeMs = +(Number(endTime - startTime) / 1e6).toFixed(2);

                    EXPECT(queryObject, 'query expression in ORM form').to.be.deep.equal({
                        '$or': [
                            {
                                '$and': [
                                    {
                                        first_name: {
                                            '$like': '%\\e\\s\\c\\u%'
                                        }
                                    }, 
                                    {
                                        age: {
                                            '$gt': '60',
                                        }
                                    }
                                ],
                            },
                            {
                                '$and': [
                                    {
                                        last_name: {
                                            '$in': ['sonia']
                                        }
                                    }, 
                                    {
                                        city: {
                                            '$eq': 'Cluj',
                                        }
                                    }
                                ]
                            }
                        ]
                    });
                    EXPECT(orderBy, 'order by').to.be.deep.equal([['created', 'ASC'], ['age', 'ASC']]);
                    EXPECT(totalTimeMs, 'total time').to.be.lessThan(2);

                    let reconstructedInputQuerystring = QUERY.serializeToQuerystring(queryObject, orderBy);
                    let inputQuerystring = new URL(input).search.replace(/^\?/, '');
                    EXPECT(reconstructedInputQuerystring, 'reconstructed input').to.equal(inputQuerystring);
                });

                it('Should parse query correctly, query with operand expression group with more than two operands inside but same operator', async () => {
                    let input = _prepareQueryTestURL(
                        'fld[age][lt][1]=15',
                        'fld[age][gt][2]=6',
                        'fld[age][lte][3]=17',
                        'fld[age][gte][4]=8',
                        'ops=([1]AND[2]AND[3]AND[4])',
                        'ord[age]=desc'
                    );
                    let inputQuerystringMap = new URL(input).searchParams;
                    let params = Object.fromEntries(inputQuerystringMap.entries());

                    let startTime = process.hrtime.bigint();
                    let {
                        queryObject,
                        orderBy
                    } = QUERY_PARSER.deserializeFromQuerystring(
                        params,
                        ['first_name', 'age', 'last_name', 'city', 'created'],
                        ['first_name', 'age', 'last_name', 'city', 'created']
                    );
                    let endTime = process.hrtime.bigint();
                    let totalTimeMs = +(Number(endTime - startTime) / 1e6).toFixed(2);

                    EXPECT(queryObject, 'query expression in ORM form').to.be.deep.equal({
                        '$and': [
                            {
                                age: {
                                    '$lt': '15',
                                }
                            },
                            {
                                age: {
                                    '$gt': '6',
                                }
                            },
                            {
                                age: {
                                    '$lte': '17',
                                }
                            },
                            {
                                age: {
                                    '$gte': '8',
                                }
                            }
                        ],
                    });
                    EXPECT(orderBy, 'order by').to.be.deep.equal([['age', 'DESC']]);
                    EXPECT(totalTimeMs, 'total time').to.be.lessThan(2);

                    let reconstructedInputQuerystring = QUERY.serializeToQuerystring(queryObject, orderBy);
                    let inputQuerystring = new URL(input).search.replace(/^\?/, '');
                    EXPECT(reconstructedInputQuerystring, 'reconstructed input').to.equal(inputQuerystring);
                });

                it('Should parse query correctly, query with operand expression with two references to the same id', async () => {
                    let input = _prepareQueryTestURL(
                        'fld[first_name][like][1]=escu',
                        'fld[first_name][like][2]=rescu',
                        'fld[first_name][like][3]=PESCU',
                        'fld[first_name][like][4]=SPESCU',
                        'fld[last_name][in][5]=sonia',
                        'fld[city][in][6]=Cluj,Arad',
                        'ops=([1]AND[2])OR([3]AND[4])AND([5]AND[6]OR[1])'
                    );
                    let inputQuerystringMap = new URL(input).searchParams;
                    let params = Object.fromEntries(inputQuerystringMap.entries());

                    let startTime = process.hrtime.bigint();
                    let {
                        queryObject,
                        orderBy
                    } = QUERY_PARSER.deserializeFromQuerystring(
                        params,
                        ['first_name', 'age', 'last_name', 'city', 'created'],
                        ['first_name', 'age', 'last_name', 'city', 'created']
                    );
                    let endTime = process.hrtime.bigint();
                    let totalTimeMs = +(Number(endTime - startTime) / 1e6).toFixed(2);

                    EXPECT(queryObject, 'query expression in ORM form').to.be.deep.equal({
                        '$and': [
                            {
                                '$or': [
                                    {
                                        '$and': [
                                            {
                                                first_name: {
                                                    '$like': '%\\e\\s\\c\\u%'
                                                }
                                            }, 
                                            {
                                                first_name: {
                                                    '$like': '%\\r\\e\\s\\c\\u%',
                                                }
                                            }
                                        ],
                                    },
                                    {
                                        '$and': [
                                            {
                                                first_name: {
                                                    '$like': '%\\P\\E\\S\\C\\U%'
                                                }
                                            }, 
                                            {
                                                first_name: {
                                                    '$like': '%\\S\\P\\E\\S\\C\\U%',
                                                }
                                            }
                                        ],
                                    },
                                ],
                            },
                            {
                                '$or': [
                                    {
                                        '$and': [
                                            {
                                                last_name: {
                                                    '$in': ['sonia']
                                                }
                                            }, 
                                            {
                                                city: {
                                                    '$in': ['Cluj', 'Arad'],
                                                }
                                            }
                                        ]
                                    },
                                    {
                                        first_name: {
                                            '$like': '%\\e\\s\\c\\u%'
                                        }
                                    },
                                ]
                            }
                        ]
                    });
                    EXPECT(orderBy, 'order by').to.be.deep.equal([]);
                    EXPECT(totalTimeMs, 'total time').to.be.lessThan(2);

                    let reconstructedInputQuerystring = QUERY.serializeToQuerystring(queryObject, orderBy);
                    let inputQuerystring = new URL(input).search.replace(/^\?/, '');
                    EXPECT(reconstructedInputQuerystring, 'reconstructed input').to.equal(inputQuerystring);
                });

                it('Should parse query correctly, query with very similar field expressions i.e. similar fields are not confused as identical', async () => {
                    let input = _prepareQueryTestURL(
                        'fld[age][eq][1]=34',
                        'fld[created][eq][2]=34',
                        'ops=([1]AND[2])',
                        'ord[age]=desc'
                    );
                    let inputQuerystringMap = new URL(input).searchParams;
                    let params = Object.fromEntries(inputQuerystringMap.entries());

                    let startTime = process.hrtime.bigint();
                    let {
                        queryObject,
                        orderBy
                    } = QUERY_PARSER.deserializeFromQuerystring(
                        params,
                        ['first_name', 'age', 'last_name', 'city', 'created'],
                        ['first_name', 'age', 'last_name', 'city', 'created']
                    );
                    let endTime = process.hrtime.bigint();
                    let totalTimeMs = +(Number(endTime - startTime) / 1e6).toFixed(2);

                    EXPECT(queryObject, 'query expression in ORM form').to.be.deep.equal({
                        '$and': [
                            {
                                age: {
                                    '$eq': '34',
                                }
                            },
                            {
                                created: {
                                    '$eq': '34'
                                }
                            }
                        ]
                    });
                    EXPECT(orderBy, 'order by').to.be.deep.equal([['age', 'DESC']]);
                    EXPECT(totalTimeMs, 'total time').to.be.lessThan(2);

                    let reconstructedInputQuerystring = QUERY.serializeToQuerystring(queryObject, orderBy);
                    let inputQuerystring = new URL(input).search.replace(/^\?/, '');
                    EXPECT(reconstructedInputQuerystring, 'reconstructed input').to.equal(inputQuerystring);
                });

                it('Should parse query correctly, query with complex operand expression with all possible operators', async () => {
                    let input = _prepareQueryTestURL(
                        'fld[first_name][like][1]=escu',
                        'fld[first_name][ilike][2]=rescu',
                        'fld[first_name][like][3]=PESCU',
                        'fld[first_name][ilike][4]=SPESCU',
                        'fld[age][lt][5]=15',
                        'fld[age][gt][6]=6',
                        'fld[age][lte][7]=17',
                        'fld[age][gte][8]=8',
                        'fld[last_name][in][9]=sonia',
                        'fld[city][in][10]=Cluj,Arad',
                        'fld[created][eq][11]=123456',
                        'fld[created][neq][12]=654321',
                        'ops=([1]AND[2])OR([3]AND[4])AND([5]AND[6]AND[7]AND[8])OR([9]AND[10]OR[11]OR[12])'
                    );
                    let inputQuerystringMap = new URL(input).searchParams;
                    let params = Object.fromEntries(inputQuerystringMap.entries());

                    let startTime = process.hrtime.bigint();
                    let {
                        queryObject,
                        orderBy
                    } = QUERY_PARSER.deserializeFromQuerystring(
                        params,
                        ['first_name', 'age', 'last_name', 'city', 'created'],
                        ['first_name', 'age', 'last_name', 'city', 'created']
                    );
                    let endTime = process.hrtime.bigint();
                    let totalTimeMs = +(Number(endTime - startTime) / 1e6).toFixed(2);
            
                    EXPECT(queryObject, 'query expression in ORM form').to.be.deep.equal({
                        '$or': [
                            {
                                '$and': [
                                    {
                                        '$or': [
                                            {
                                                '$and': [
                                                    {
                                                        first_name: {
                                                            '$like': '%\\e\\s\\c\\u%'
                                                        }
                                                    }, 
                                                    {
                                                        first_name: {
                                                            '$ilike': '%\\r\\e\\s\\c\\u%',
                                                        }
                                                    }
                                                ],
                                            },
                                            {
                                                '$and': [
                                                    {
                                                        first_name: {
                                                            '$like': '%\\P\\E\\S\\C\\U%'
                                                        }
                                                    }, 
                                                    {
                                                        first_name: {
                                                            '$ilike': '%\\S\\P\\E\\S\\C\\U%',
                                                        }
                                                    }
                                                ],
                                            },
                                        ]
                                    },
                                    {
                                        '$and': [
                                            {
                                                age: {
                                                    '$lt': '15',
                                                }
                                            },
                                            {
                                                age: {
                                                    '$gt': '6',
                                                }
                                            },
                                            {
                                                age: {
                                                    '$lte': '17',
                                                }
                                            },
                                            {
                                                age: {
                                                    '$gte': '8',
                                                }
                                            }
                                        ],
                                    }
                                ]
                            },
                            {
                                '$or': [
                                    {
                                        '$and': [
                                            {
                                                last_name: {
                                                    '$in': ['sonia']
                                                }
                                            }, 
                                            {
                                                city: {
                                                    '$in': ['Cluj', 'Arad'],
                                                }
                                            }
                                        ]
                                    },
                                    {
                                        created: {
                                            '$eq': '123456'
                                        }
                                    },
                                    {
                                        created: {
                                            '$ne': '654321'
                                        }
                                    }
                                ]
                            }
                        ]
                    });
                    EXPECT(orderBy, 'order by').to.be.deep.equal([]);
                    EXPECT(totalTimeMs, 'total time').to.be.lessThan(2);

                    let reconstructedInputQuerystring = QUERY.serializeToQuerystring(queryObject, orderBy);
                    let inputQuerystring = new URL(input).search.replace(/^\?/, '');
                    EXPECT(reconstructedInputQuerystring, 'reconstructed input').to.equal(inputQuerystring);
                });
            });

            describe('Automated white-box tests', () => {
                it('Should parse query correctly, automatically generated query with complex operand expression (check is done with reconstructed input)', async () => {
                    let getRandomFieldOperator = _makeGetRandomElementFromList(QUERY_PARSER.VALID_FIELD_OP_LIST);
                    let getRandomGroupOperator = _makeGetRandomElementFromList(QUERY_PARSER.VALID_GROUP_OP_LIST);
                    let getRandomOrderDirection = _makeGetRandomElementFromList(QUERY_PARSER.VALID_SORT_DIR_LIST);
                    let getRandomName = _makeGetRandomElementFromList(VALID_COLUMNS_LIST);

                    let getRandomField = (index) => {
                        let value = _getRandomIntBetween(1,100);
                        let first_name = getRandomName();
                        let fieldOp = getRandomFieldOperator();
                        
                        return `fld[${first_name}][${fieldOp}][${index}]=${value}`;
                    };

                    let generateRandomURLWithQuery = () => {
                        //=== Generate random fields and an expression with them ===//
                        let groupCount = _getRandomIntBetween(1, 3);
                        let groupsList = [];
                        let fieldsList = [];

                        for (let group = 1; group <= groupCount; group++) {
                            let groupExpression = [];
                            let operatorCount = _getRandomIntBetween(1, 4);

                            // Add pairs of operands and operators to make a group
                            for (let operator = 1; operator <= operatorCount + 1; operator++) {
                                let index = fieldsList.length + 1;
                                fieldsList.push(getRandomField(index));

                                let intraGroupOp = getRandomGroupOperator();
                                groupExpression.push(`${QUERY_PARSER.ID_DELIM_START_CHAR}${index}${QUERY_PARSER.ID_DELIM_END_CHAR}`, intraGroupOp);
                            }

                            // Remove extra operator to make a valid group expression
                            groupExpression.pop();

                            // Add pairs of groups and operators to make a full expression
                            let interGroupOp = getRandomGroupOperator();
                            groupsList.push(`${QUERY_PARSER.EXPRESSION_DELIM_START_CHAR}${groupExpression.join('')}${QUERY_PARSER.EXPRESSION_DELIM_END_CHAR}` , interGroupOp);
                        }

                        // Remove extra operator to make a valid full expression
                        groupsList.pop();

                        let opsParam = `${QUERY_PARSER.OPS_PARAM_NAME}=${groupsList.join('')}`;

                        //=== Generate random order params ===//
                        let orderParamsList = [];
                        let orderCount = _getRandomIntBetween(1, 3);

                        for (let order = 1; order <= orderCount; order++) {
                            let first_name = getRandomName();
                            let direction = getRandomOrderDirection().toLowerCase();
                            orderParamsList.push(`${QUERY_PARSER.ORDER_PARAM_PREFIX}[${first_name}]=${direction}`);
                        }

                        let paramsList = fieldsList.concat([opsParam], orderParamsList);

                        return _prepareQueryTestURL(paramsList);
                    };

                    const timingsList = [];

                    // Generate random valid URLs then for each one perform a deserialize > re-serialize  
                    // operation and compare the reconstructed input to the original input => automated tests
                    for (let autoTest = 1; autoTest <= 50; autoTest++) {
                        let generatedInput = generateRandomURLWithQuery();
                        let inputQuerystringMap = new URL(generatedInput).searchParams;
                        let params = Object.fromEntries(inputQuerystringMap.entries());

                        let startTime = process.hrtime.bigint();
                        let {
                            queryObject,
                            orderBy
                        } = QUERY_PARSER.deserializeFromQuerystring(params, VALID_COLUMNS_LIST, VALID_COLUMNS_LIST);
                        let endTime = process.hrtime.bigint();
                        let totalTimeMs = +(Number(endTime - startTime) / 1e6).toFixed(2);
                        timingsList.push(totalTimeMs);
                        EXPECT(totalTimeMs, 'max total time in ms').to.be.lessThan(2);

                        let reconstructedInputQuerystring = QUERY.serializeToQuerystring(queryObject, orderBy);
                        let inputQuerystring = new URL(generatedInput).search.replace(/^\?/, '');
                        EXPECT(reconstructedInputQuerystring, 'reconstructed input').to.equal(inputQuerystring);
                    }

                    let avgTimeMs = timingsList.reduce((a, b) => a + b) / timingsList.length;
                    EXPECT(avgTimeMs, 'average time in ms').to.be.lessThan(0.4);
                });
            });

            describe('Correct error message tests', () => {
                it('Should return "400 Bad Request" error response, query with more top-level operators than appropriate for the number of operands', async () => {
                    let response = await FRISBY.get(_prepareQueryTestURL(
                            'fld[created][gt][1]=0',
                            'fld[created][lt][2]=2',
                            'ops=([2]OR[1])AND'
                        ))
                        .expect('status', 400)
                        .expect('jsonTypes', INSTANCE_SCHEMA_ERROR);
                    
                    _expectErrorWithCode(response, 911);
                });

                it('Should return "400 Bad Request" error response, query with more group-level operators than appropriate for the number of operands', async () => {
                    let response = await FRISBY.get(_prepareQueryTestURL(
                            'fld[created][gt][1]=0',
                            'fld[created][lt][2]=2',
                            'ops=([2]OR[1])AND([2]OR[1]AND)'
                        ))
                        .expect('status', 400)
                        .expect('jsonTypes', INSTANCE_SCHEMA_ERROR);

                    _expectErrorWithCode(response, 911);
                });

                it('Should return "400 Bad Request" error response, query with id segment number not encased in correct end delimiter', async () => {
                    let response = await FRISBY.get(_prepareQueryTestURL(
                            'fld[created][gt][1]=0',
                            'fld[created][lt][2]=2',
                            'ops=([2]OR[1])AND([2)OR[1])'
                        ))
                        .expect('status', 400)
                        .expect('jsonTypes', INSTANCE_SCHEMA_ERROR);

                    _expectErrorWithCode(response, 912);
                });

                it('Should return "400 Bad Request" error response, query with id segment not a valid number', async () => {
                    let response = await FRISBY.get(_prepareQueryTestURL(
                            'fld[created][gt][1]=0',
                            'fld[created][lt][2]=2',
                            'ops=([2]OR[1])AND([2]OR[^1])'
                        ))
                        .expect('status', 400)
                        .expect('jsonTypes', INSTANCE_SCHEMA_ERROR);

                    _expectErrorWithCode(response, 912);
                });

                it('Should return "400 Bad Request" error response, query with ops id which is not present in the query field parameters', async () => {
                    let response = await FRISBY.get(_prepareQueryTestURL(
                            'fld[created][gt][1]=0',
                            'ops=([2])'
                        ))
                        .expect('status', 400)
                        .expect('jsonTypes', INSTANCE_SCHEMA_ERROR);

                    _expectErrorWithCode(response, 914);
                });

                it('Should return "400 Bad Request" error response, query with missing character at start of group expression', async () => {
                    let response = await FRISBY.get(_prepareQueryTestURL(
                            'fld[created][gt][1]=0',
                            'ops=([1]OR[1])AND[1])'
                        ))
                        .expect('status', 400)
                        .expect('jsonTypes', INSTANCE_SCHEMA_ERROR);

                    _expectErrorWithCode(response, 916);
                });

                it('Should return "400 Bad Request" error response, query with invalid character at start of group expression', async () => {
                    let response = await FRISBY.get(_prepareQueryTestURL(
                            'fld[created][gt][1]=0',
                            'ops=([1]AND[1])ORR[1])'
                        ))
                        .expect('status', 400)
                        .expect('jsonTypes', INSTANCE_SCHEMA_ERROR);

                    _expectErrorWithCode(response, 916);
                });

                it('Should return "400 Bad Request" error response, query with invalid character at start of ops expression', async () => {
                    let response = await FRISBY.get(_prepareQueryTestURL(
                            'fld[created][gt][1]=0',
                            'ops=$1])'
                        ))
                        .expect('status', 400)
                        .expect('jsonTypes', INSTANCE_SCHEMA_ERROR);

                    _expectErrorWithCode(response, 916);
                });

                it('Should return "400 Bad Request" error response, query with invalid character inside of expression', async () => {
                    let response = await FRISBY.get(_prepareQueryTestURL(
                            'fld[created][gt][1]=0',
                            'ops=([1]OR(1])'
                        ))
                        .expect('status', 400)
                        .expect('jsonTypes', INSTANCE_SCHEMA_ERROR);

                    _expectErrorWithCode(response, 916);
                });

                it('Should return "400 Bad Request" error response, query with missing operator between groups in expression', async () => {
                    let response = await FRISBY.get(_prepareQueryTestURL(
                            'fld[created][gt][1]=0',
                            'fld[created][lt][2]=2',
                            'ops=([2]OR[1]AND[1])AND([2]OR[1]AND[1])AND([2])([1])'
                        ))
                        .expect('status', 400)
                        .expect('jsonTypes', INSTANCE_SCHEMA_ERROR);

                    _expectErrorWithCode(response, 915);
                });

                it('Should return "400 Bad Request" error response, query with missing operator inside group in expression', async () => {
                    let response = await FRISBY.get(_prepareQueryTestURL(
                            'fld[created][gt][1]=0',
                            'fld[created][lt][2]=2',
                            'ops=([2]OR[1]AND[1])AND([2]OR[1]AND[1]OR[1][1])'
                        ))
                        .expect('status', 400)
                        .expect('jsonTypes', INSTANCE_SCHEMA_ERROR);

                    _expectErrorWithCode(response, 915);
                });

                it('Should return "400 Bad Request" error response, query with invalid operator used inside group in expression', async () => {
                    let response = await FRISBY.get(_prepareQueryTestURL(
                            'fld[created][gt][1]=0',
                            'fld[created][lt][2]=2',
                            'ops=([2]OR[1]AND[1])AND([2]NOR[1])'
                        ))
                        .expect('status', 400)
                        .expect('jsonTypes', INSTANCE_SCHEMA_ERROR);

                    _expectErrorWithCode(response, 917);
                });

                it('Should return "400 Bad Request" error response, query with invalid operator used outside group in expression', async () => {
                    let response = await FRISBY.get(_prepareQueryTestURL(
                            'fld[created][gt][1]=0',
                            'fld[created][lt][2]=2',
                            'ops=([2]OR[1]AND[1])AND([2]OR[1])XOR([1]AND[2])'
                        ))
                        .expect('status', 400)
                        .expect('jsonTypes', INSTANCE_SCHEMA_ERROR);

                    _expectErrorWithCode(response, 917);
                });

                it('Should return "400 Bad Request" error response, query with invalid field parameter i.e. does not conform to expected pattern: fld[first_name][op][uuid]', async () => {
                    let response = await FRISBY.get(_prepareQueryTestURL(
                            'fld[[created]][gt](1)=6'
                        ))
                        .expect('status', 400)
                        .expect('jsonTypes', INSTANCE_SCHEMA_ERROR);

                    _expectErrorWithCode(response, 919);

                    response = await FRISBY.get(_prepareQueryTestURL(
                            'fld[created][gt][1][2]=0'
                        ))
                        .expect('status', 400)
                        .expect('jsonTypes', INSTANCE_SCHEMA_ERROR);

                    _expectErrorWithCode(response, 919);

                    response = await FRISBY.get(_prepareQueryTestURL(
                            'fld[status[created]][gt][[1][2]]=0'
                        ))
                        .expect('status', 400)
                        .expect('jsonTypes', INSTANCE_SCHEMA_ERROR);

                    _expectErrorWithCode(response, 919);
                });

                it('Should return "400 Bad Request" error response, query with invalid operator used in field parameter', async () => {
                    let response = await FRISBY.get(_prepareQueryTestURL(
                            'fld[created][regex][1]=0'
                        ))
                        .expect('status', 400)
                        .expect('jsonTypes', INSTANCE_SCHEMA_ERROR);

                    _expectErrorWithCode(response, 920);
                });

                it('Should return "400 Bad Request" error response, query with order parameter that does not conform to expected pattern: ord[first_name]', async () => {
                    let response = await FRISBY.get(_prepareQueryTestURL(
                            'fld[created][gt][1]=0',
                            'ord[created]=asc',
                            'ord[status,uuid]=desc'
                        ))
                        .expect('status', 400)
                        .expect('jsonTypes', INSTANCE_SCHEMA_ERROR);

                    _expectErrorWithCode(response, 921);

                    response = await FRISBY.get(_prepareQueryTestURL(
                            'fld[created][gt][1]=0',
                            'ord[created]=asc',
                            'ord[created][age]=desc'
                        ))
                        .expect('status', 400)
                        .expect('jsonTypes', INSTANCE_SCHEMA_ERROR);

                    _expectErrorWithCode(response, 921);
                });

                it('Should return "400 Bad Request" error response, query with invalid sort direction used in order parameter', async () => {
                    let response = await FRISBY.get(_prepareQueryTestURL(
                            'fld[created][gt][1]=0',
                            'ord[created]=asc',
                            'ord[modified]=random'
                        ))
                        .expect('status', 400)
                        .expect('jsonTypes', INSTANCE_SCHEMA_ERROR);

                    _expectErrorWithCode(response, 922);
                });

                it('Should return "400 Bad Request" error response, query with pattern matching operators LIKE / ILIKE but no value specified', async () => {
                    let response = await FRISBY.get(_prepareQueryTestURL(
                            'fld[created][ilike]=',
                            'fld[created][like]=',
                            'ord[created]=asc'
                        ))
                        .expect('status', 400)
                        .expect('jsonTypes', INSTANCE_SCHEMA_ERROR);

                    _expectErrorWithCode(response, 923);
                });

                it('Should return "400 Bad Request" error response, query with ops expression but no fields', async () => {
                    let response = await FRISBY.get(_prepareQueryTestURL(
                            'ops=([1]OR[2])',
                            'ord[created]=asc'
                        ))
                        .expect('status', 400)
                        .expect('jsonTypes', INSTANCE_SCHEMA_ERROR);

                    _expectErrorWithCode(response, 924);
                });

                it('Should return "400 Bad Request" error response, query with empty groups in expression', async () => {
                    let response = await FRISBY.get(_prepareQueryTestURL(
                            'fld[created][gt][1]=0',
                            'fld[created][lt][2]=2',
                            'ops=([2]OR[1])AND()'
                        ))
                        .expect('status', 400)
                        .expect('jsonTypes', INSTANCE_SCHEMA_ERROR);

                    _expectErrorWithCode(response, 918);
                });

                it('Should return "400 Bad Request" error response, query with field which has empty id segment', async () => {
                    let response = await FRISBY.get(_prepareQueryTestURL(
                            'fld[created][gt][1]=0',
                            'fld[created][lt][2]=2',
                            'ops=([2]OR[1])AND([2]OR[1]OR[]OR[1000])'
                        ))
                        .expect('status', 400)
                        .expect('jsonTypes', INSTANCE_SCHEMA_ERROR);

                    _expectErrorWithCode(response, 913);
                });

                it('Should return "400 Bad Request" error response, query with field which has not allowed filter column', async () => {
                    let response = await FRISBY.get(_prepareQueryTestURL(
                            'fld[age][gt][1]=0',
                            'fld[created][lt][2]=2',
                            'ops=([1]OR[2])'
                        ))
                        .expect('status', 400)
                        .expect('jsonTypes', INSTANCE_SCHEMA_ERROR);

                    _expectErrorWithCode(response, 925);
                });

                it('Should return "400 Bad Request" error response, query with field which has not allowed sort column', async () => {
                    let response = await FRISBY.get(_prepareQueryTestURL(
                            'fld[created][gt][1]=0',
                            'fld[created][lt][2]=2',
                            'ops=([1]OR[2])',
                            'ord[age]=asc'
                        ))
                        .expect('status', 400)
                        .expect('jsonTypes', INSTANCE_SCHEMA_ERROR);

                    _expectErrorWithCode(response, 926);
                });
            });
        });
});