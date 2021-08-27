/* eslint-disable no-underscore-dangle */
import FluentS from 'fluent-json-schema';
import { isObject } from './functions.js';

// Add static extensions to fix Fluent JSON Schema library issues

/**
 * Access JSON Schema internal schema representation object and modify it by
 * removing the `required` attribute since the official API is too rigid.
 * If the schema is a raw JSON schema or an internal schema representation
 * operate on it directly, to be able to remove `required` recursively
 *
 * @param {FluentJSONSchema} schema - what to fix
 * @return {FluentJSONSchema}
 */
function removeRequired(schema) {
  const internalSchemaRepresentation = schema?._getState?.() || schema;
  delete internalSchemaRepresentation.required;

  // Handle special cases as well with nested schemas
  if (Array.isArray(internalSchemaRepresentation.oneOf)) {
    internalSchemaRepresentation.oneOf.forEach(removeRequired);
  }
  if (Array.isArray(internalSchemaRepresentation.allOf)) {
    internalSchemaRepresentation.allOf.forEach(removeRequired);
  }
  if (Array.isArray(internalSchemaRepresentation.anyOf)) {
    internalSchemaRepresentation.anyOf.forEach(removeRequired);
  }

  if (isObject(internalSchemaRepresentation.properties)) {
    Object.values(internalSchemaRepresentation.properties).forEach(prop => {
      if (prop.type === 'object' || prop.anyOf || prop.allOf || prop.oneOf) {
        removeRequired(prop);
      }
    });
  }

  // Return the mutated schema
  return schema;
}

FluentS.removeRequired = removeRequired;

/**
 * Access internal schema representation object and modify it by removing
 * the `id` attribute to avoid certain problematic schema reuse scenarios
 *
 * @param {FluentJSONSchema} schema - what to fix
 * @return {FluentJSONSchema}
 */
FluentS.removeId = function removeId(schema) {
  delete schema._getState().$id;

  // Return the mutated schema
  return schema;
};

/**
 * Access internal schema representation object and retrieve type from schema
 *
 * @param {FluentJSONSchema} schema - schema to get type of
 * @return {string}
 */
FluentS.getType = function getType(schema) {
  return schema._getState().type;
};

/**
 * Access internal schema representation object and pass it to the
 * Fluent schema object constructor to reconstruct it properly if mangled
 *
 * @param {FluentJSONSchema} schema - what to fix
 * @return {FluentJSONSchema}
 */
FluentS.cloneObject = function cloneObject(schema) {
  if (FluentS.getType(schema) !== 'object') {
    throw new TypeError('Schema must be of "object" type');
  }

  // This will effectively duplicate and fix the schema
  const newSchema = FluentS.withOptions().object(schema._getState());

  // Except it will duplicate the last property so we need to fix this
  const internalState = newSchema._getState();
  internalState.properties.pop();

  return newSchema;
};

/**
 * Make a new schema by duplicating an existing one and then
 * exclude a list of properties, useful for easier schema reuse
 *
 * @param {FluentJSONSchema} schema - schema to reuse
 * @param {Array<string>} [propsList = []] - properties to exclude
 * @return {FluentJSONSchema}
 */
FluentS.exclude = function exclude(schema, propsList = []) {
  if (FluentS.getType(schema) !== 'object') {
    throw new TypeError('Schema must be of "object" type');
  }

  // Initialize new schema by duplicating the one received
  const newSchema = FluentS.cloneObject(schema);

  // Remove excluded properties directly by mutating the internal represation
  const newSchemaState = newSchema._getState();

  propsList.forEach(filteredProp => {
    newSchemaState.properties = newSchemaState.properties.filter(
      propDescription => propDescription.name !== filteredProp
    );
    newSchemaState.required = newSchemaState.required.filter(
      requiredProp => requiredProp !== filteredProp
    );
  });

  // Return the adjusted duplicated schema
  return newSchema;
};

// Alias for exclude
FluentS.except = FluentS.exclude;

/**
 * Merge schemas without mangling the Fluent JSON Schema
 * object like a simple schema1.extend(schema2) would do
 * In essence, schema1 is extended with schema2.
 *
 * @param {FluentJSONSchema} schema1 - first schema
 * @param {FluentJSONSchema} schema2 - second schema
 * @param {string} newId new id of extended schema, if not provided the one
 *   from schema1 will be used
 * @return {FluentJSONSchema}
 */
FluentS.mergeSchemas = function mergeSchemas(schema1, schema2, newId = null) {
  if ((FluentS.getType(schema1) !== 'object')
    || (FluentS.getType(schema2) !== 'object')) {
    throw new TypeError('Schemas must be of "object" type');
  }

  const extendedSchema = schema1.extend(schema2);
  if (newId) {
    extendedSchema._getState().$id = newId;
  }
  return FluentS.cloneObject(extendedSchema);
};

/**
 * Merge schemas without mangling the Fluent JSON Schema object.
 * It works like S.mergeSchemas() but operates on an array of schemas
 *
 * @param {Array<FluentJSONSchema>} schemaList - list of schemas to merge
 * @param {string} newId - new id of resulting schema, if not provided the one
 *   from the first schema in the list will be used
 * @return {FluentJSONSchema}
 */
FluentS.mergeSchemasList = function mergeSchemasList(schemaList, newId = null) {
  return schemaList.reduce(
    (reduced, schema) => FluentS.mergeSchemas(reduced, schema, newId)
  );
};

export const S = FluentS;