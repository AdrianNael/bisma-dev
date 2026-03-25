/**
 * Template Cache Helper
 * Caches EJS templates to avoid repeated disk reads
 */
import fs from 'fs/promises';

const templateCache = new Map();

/**
 * Get a cached template or read from disk
 * @param {string} templatePath - Path to the template file
 * @returns {Promise<string>} Template content
 */
export const getCachedTemplate = async (templatePath) => {
    if (templateCache.has(templatePath)) {
        return templateCache.get(templatePath);
    }

    const templateHtml = await fs.readFile(templatePath, 'utf-8');
    templateCache.set(templatePath, templateHtml);
    return templateHtml;
};

/**
 * Clear a specific template from cache
 * @param {string} templatePath - Path to the template file
 */
export const clearTemplateCache = (templatePath) => {
    templateCache.delete(templatePath);
};

/**
 * Clear all templates from cache
 */
export const clearAllTemplateCache = () => {
    templateCache.clear();
};

/**
 * Get cache stats
 */
export const getTemplateCacheStats = () => {
    return {
        size: templateCache.size,
        keys: Array.from(templateCache.keys()),
    };
};
