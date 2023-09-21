const fs = require('fs/promises');
const path = require('path');
const yaml = require('js-yaml');

const YML_FILE_EXTENSION = '.yml';

const servicesDir = path.resolve(__dirname, '../../services/');

/**
 * Converts a service name to lowercase and replaces special characters.
 *
 * @param {string} serviceName - The service name to be normalized.
 * @returns {string} The normalized service name.
 */
const normalizeFileName = (serviceName) => {
    const specificCharacters = new RegExp(/[^a-z0-9.]/, 'g');
    const lowerCased = serviceName.toLowerCase();
    const normalized = lowerCased.replace(specificCharacters, '');
    return normalized;
};

/**
 * Reads and parses the services data from from a JSON file.
 *
 * @param {string} jsonFilePath - The path to the JSON file.
 * @returns {Promise<Array<Object>>|null} A promise that resolves to an array of services data objects from JSON file.
 * if the JSON file is successfully read and parsed. Returns `null` if there's an error during the process.
 */
const getJsonObjects = async (jsonFilePath) => {
    try {
        const jsonFileContent = await fs.readFile(jsonFilePath);
        const jsonObjects = JSON.parse(jsonFileContent);
        return jsonObjects.blocked_services;
    } catch (error) {
        console.error('Error while reading JSON file:', error);
        return null;
    }
};

/**
 * Gets the names of services from JSON file after normalization.
 *
 * @param {Promise<Array<object>>} jsonData - An array of objects from services.json file.
 * @returns {Promise<Array<string>>} An array of normalized service id form JSON.
 */
const getJsonObjectNames = async (jsonData) => {
    // get array with id's from json data
    const jsonServicesId = jsonData.map((service) => service.id);
    // format file names
    const formattedServicesId = jsonServicesId.map(normalizeFileName);
    // sort array by name
    formattedServicesId.sort();
    return formattedServicesId;
};

/**
 * Gets the names of YML file from the services folder.
 *
 * @param {string} servicesFolderPath - The path to the folder containing YML service files.
 * @returns {Promise<Array<string>>} An array of normalized yml file names.
 */
const getYmlFileNames = async (servicesFolderPath) => {
    // get all dir names from services folder
    const ymlFiles = await fs.readdir(servicesFolderPath);
    // get the file names without its extension
    const ymlFileNames = ymlFiles.map((ymlFile) => {
        const ymlFileName = path.parse(ymlFile).name;
        return ymlFileName;
    });
    // format file names
    const formattedServiceNames = ymlFileNames.map(normalizeFileName);
    // sort array by name
    formattedServiceNames.sort();
    return formattedServiceNames;
};

/**
 * Write removed services objects into YML files.
 * @param {Array<object>} removedObjects - Array of objects that should be written in separate YML files.
 */
const writeRemovedServices = async (removedObjects) => {
    if (removedObjects.length === 0) {
        return;
    }
    const [removedObject, ...restObjects] = removedObjects;
    await fs.writeFile(
        path.join(`${servicesDir}/${removedObject.id}${YML_FILE_EXTENSION}`),
        yaml.dump(removedObject, { lineWidth: -1 }),
    );
    if (removedObjects.length > 1) {
        await writeRemovedServices(restObjects);
    }
};

/**
 * Rewrites YAML files for removed services.
 *
 * @param {Array<string>} removedServicesNames - An array of removed normalized service names.
 * @param {Array<objects>} jsonServicesData - An array of json data objects
 * @throws {Error} If there is an error while rewriting file.
 */
const rewriteYMLFile = async (removedServicesNames, jsonServicesData) => {
    try {
        // Get services objects from the json data, that have been deleted in services folder.
        const removedServicesObjects = removedServicesNames
            .map((removedServiceName) => {
                const serviceData = jsonServicesData
                    .find(({ id }) => normalizeFileName(id) === removedServiceName);
                return serviceData;
            });
        await writeRemovedServices(removedServicesObjects);
    } catch (error) {
        console.error('Error while rewriting file:', error);
    }
};

/**
 * Checks for removed services and rewrites YAML files if necessary.
 *
 * @param {string} servicesFolderPath - The path to the folder /services.
 * @param {string} jsonFilePath - The path to the JSON file containing old services data /assets/services.json.
 */
const checkRemovedServices = async (servicesFolderPath, jsonFilePath) => {
    // Get data from services JSON file - array with objects
    const jsonDataObjects = await getJsonObjects(jsonFilePath);
    // Check if data is array
    if (!Array.isArray(jsonDataObjects)) {
        return;
    }
    // Array with normalized YML file names from services folder.
    const ymlFileNames = await getYmlFileNames(servicesFolderPath);
    // Array with normalized id of services from JSON file.
    const jsonObjectNames = await getJsonObjectNames(jsonDataObjects);
    // Array with the names of services, the id of which is present in services.json
    // and absent in the name of YML files from the services folder.
    const differences = jsonObjectNames.filter((name) => !ymlFileNames.includes(name));
    // If there are missing services, it is necessary to find the corresponding object in services.json
    // and rewrite the data from it into a separate YML file.
    if (differences.length > 0) {
        await rewriteYMLFile(differences, jsonDataObjects);
        console.log(`These services have been removed: ${differences.join(', ')}, and were rewritten`);
    }
};

module.exports = { checkRemovedServices };
