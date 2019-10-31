const puppeteer = require("puppeteer");

let browser;
let page;

let commandQueue = [];
let inProgress = false;

let shouldClose = false;

async function startService() {
  browser = await puppeteer.launch();
  page = await browser.newPage();
}

async function closeService() {
  shouldClose = true;
}

async function take(url, path, callback) {
  inProgress = true;

  await page.goto(url, { waitUntil: "networkidle2" });

  if (typeof callback === "function") {
    await callback(page);
  }

  // const height = await page.evaluate(() => {
  //   const body = document.body,
  //     html = document.documentElement;
  //
  //   const height = Math.max(
  //     body.scrollHeight,
  //     body.offsetHeight,
  //     html.clientHeight,
  //     html.scrollHeight,
  //     html.offsetHeight
  //   );
  //
  //   return Promise.resolve(height);
  // });

  // await page.setViewport({
  //   width: 1920,
  //   height
  // });

  await page.screenshot({ path, fullPage: true });

  // remove cookies
  const cookies = await page.cookies();
  await page.deleteCookie(...cookies);

  inProgress = false;

  pop();
}

function pop() {
  if (!inProgress) {
    const args = commandQueue.shift();

    if (args) {
      take(...args);
    } else if (shouldClose) {
      browser.close();
    }
  }
}

function queue() {
  commandQueue.push(arguments);
  pop();
}

(async () => {
  // if defined from url arguments, take a screenshot
  const urlFromArguments = process.argv.slice(2)[0];

  if (urlFromArguments) {
    await startService();
    await take(urlFromArguments, "screenshot.png");
    await closeService();
  }
})();

module.exports = {
  startService,
  queue,
  closeService
};
