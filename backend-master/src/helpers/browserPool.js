/**
 * Browser Pool Helper
 * Reuses Puppeteer browser instances to improve performance
 */
import puppeteer from 'puppeteer';

let browserInstance = null;
let browserCreationPromise = null;
const BROWSER_TIMEOUT = 5 * 60 * 1000; // 5 minutes
let lastUsed = Date.now();

// Browser launch options
// allow overriding the product and executable via environment variables so
// that a Firefox install can be used instead of Chromium.  When
// PUPPETEER_PRODUCT=firefox the puppeteer package must have been installed
// with that product or the executablePath should point at a system binary.
const BROWSER_PRODUCT = process.env.PUPPETEER_PRODUCT || 'chrome';
const BROWSER_EXECUTABLE_PATH = process.env.PUPPETEER_EXECUTABLE_PATH || undefined;

const BROWSER_OPTIONS = {
    headless: true,
    product: BROWSER_PRODUCT,
    args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
    ],
};
if (BROWSER_EXECUTABLE_PATH) {
    BROWSER_OPTIONS.executablePath = BROWSER_EXECUTABLE_PATH;
}

// Page defaults
const PAGE_TIMEOUT = 30000; // 30 seconds

/**
 * Get or create a browser instance
 * @returns {Promise<Browser>}
 */
export const getBrowser = async () => {
    // If browser is being created, wait for it
    if (browserCreationPromise) {
        await browserCreationPromise;
    }

    // Check if browser is still valid
    if (browserInstance) {
        try {
            // Test if browser is still connected
            await browserInstance.version();
            lastUsed = Date.now();
            return browserInstance;
        } catch (e) {
            // Browser is disconnected, create new one
            browserInstance = null;
        }
    }

    // Create new browser
    try {
        browserCreationPromise = puppeteer.launch(BROWSER_OPTIONS);
        browserInstance = await browserCreationPromise;
        lastUsed = Date.now();
        return browserInstance;
    } catch (launchError) {
        // clear the promise so future calls can retry
        browserCreationPromise = null;
        console.error('browserPool: failed to launch browser', launchError);

        // if we tried the default chrome product and it failed, and the user
        // hasn't explicitly set a product, try firefox as a fallback.  this
        // helps environments where only firefoxis installed.
        if (BROWSER_PRODUCT === 'chrome' && !process.env.PUPPETEER_PRODUCT) {
            console.warn('browserPool: retrying launch with firefox product');
            try {
                const firefoxOptions = { ...BROWSER_OPTIONS, product: 'firefox' };
                browserCreationPromise = puppeteer.launch(firefoxOptions);
                browserInstance = await browserCreationPromise;
                lastUsed = Date.now();
                return browserInstance;
            } catch (ffErr) {
                console.error('browserPool: firefox launch also failed', ffErr);
                browserCreationPromise = null;
            }
        }

        throw launchError;
    }
};

/**
 * Create a new page with default settings
 * @returns {Promise<Page>}
 */
export const createPage = async () => {
    const browser = await getBrowser();
    const page = await browser.newPage();

    // Set default timeout
    page.setDefaultTimeout(PAGE_TIMEOUT);
    page.setDefaultNavigationTimeout(PAGE_TIMEOUT);

    return page;
};

/**
 * Close a page after use
 * @param {Page} page 
 */
export const closePage = async (page) => {
    try {
        if (page && !page.isClosed()) {
            await page.close();
        }
    } catch (e) {
        // Ignore close errors
    }
};

/**
 * Generate PDF with automatic page management
 * @param {string} html - HTML content
 * @param {Object} pdfOptions - PDF generation options
 * @returns {Promise<Buffer>}
 */
export const generatePdfBuffer = async (html, pdfOptions = {}) => {
    const page = await createPage();

    try {
        await page.setContent(html, { waitUntil: 'networkidle0' });

        const defaultOptions = {
            format: 'A4',
            landscape: true,
            printBackground: true,
            margin: {
                top: '30mm',
                right: '10mm',
                bottom: '27mm',
                left: '10mm',
            },
        };

        const pdfBuffer = await page.pdf({
            ...defaultOptions,
            ...pdfOptions,
        });

        return pdfBuffer;
    } finally {
        await closePage(page);
    }
};

/**
 * Close browser (for cleanup during shutdown)
 */
export const closeBrowser = async () => {
    if (browserInstance) {
        try {
            await browserInstance.close();
        } catch (e) {
            // Ignore close errors
        }
        browserInstance = null;
    }
};

// Cleanup interval - close browser if not used for BROWSER_TIMEOUT
setInterval(() => {
    if (browserInstance && Date.now() - lastUsed > BROWSER_TIMEOUT) {
        closeBrowser();
    }
}, 60000); // Check every minute

// Graceful shutdown
process.on('SIGTERM', closeBrowser);
process.on('SIGINT', closeBrowser);
