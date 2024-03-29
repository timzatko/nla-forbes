const dev = false;

const FEED_PAGES = 45;
const ARTICLE_PAGES = 20;

const path = require("path");
const fs = require("fs-extra");
const crypto = require("crypto");

const Crawler = require("crawler");
const NodeJsonDb = require("node-json-db");

const db = new NodeJsonDb.JsonDB("out", true, true);

const outDir = path.resolve(__dirname, "out");
fs.ensureDirSync(outDir);

const outHtmlDir = path.resolve(outDir, "html");
fs.ensureDirSync(outHtmlDir);

// get unique id for url
function getId(url) {
  const cleanUrl = new Buffer(url).toString("base64");
  return crypto
    .createHash("md5")
    .update(cleanUrl)
    .digest("hex");
}

// get html path for url
function getHtmlOutPath(url) {
  return path.resolve(outHtmlDir, getId(url) + ".html");
}

// crawler
const crawler = new Crawler({
  // rateLimit: 1000,
  maxConnections: 5
});

// counter
let counter = 0;
let writerCounter = 1;

function increment(url) {
  console.log(`[${++counter}]${url}`);
}

function error(url, e) {
  console.error(`[${++counter}][ERROR] ${url}`, e);
}

function isCrawled(url) {
  return fs.existsSync(getHtmlOutPath(url));
}

function canVisit(url) {
  return !!url.toString().match(/refresher\.sk/);
}

function parseDate(text) {
  const today = new Date();

  const match = text.match(/(\d+)\.\s+([a-zA-Zóáíú]+)\s+(\d+),\s+(\d+):(\d+)/);
  const matchToday = text.match(/dnes (\d+):(\d+)/);
  const matchYesterday = text.match(/včera (\d+):(\d+)/);

  if (matchToday) {
    const hours = Number(matchToday[1]);
    const minutes = Number(matchToday[2]);

    today.setHours(hours);
    today.setMinutes(minutes);

    return today.getTime();
  } else if (matchYesterday) {
    const hours = Number(matchYesterday[1]);
    const minutes = Number(matchYesterday[2]);

    today.setDate(today.getDate() - 1);
    today.setHours(hours);
    today.setMinutes(minutes);

    return today.getTime();
  } else if (match) {
    const day = Number(match[1]);
    const month = parseMonth(match[2]);
    const year = Number(match[3]);
    const hours = Number(match[4]);
    const minutes = Number(match[5]);

    return new Date(year, month, day, hours, minutes).getTime();
  }

  return 0;
}

function parseMonth(month) {
  return [
    "január",
    "február",
    "marec",
    "",
    "",
    "",
    "",
    "",
    "",
    "október",
    "",
    "december"
  ].indexOf(month);
}

function getText($, el) {
  const elements = Array.from(el);

  if (elements.length) {
    return $(el[0])
      .text()
      .trim();
  }
  return undefined;
}

function freshNewsCallback(e, response, done) {
  const { $, request } = response;
  const url = request.uri.href;

  if (e) {
    error(e);

    done();
  } else {
    increment(url);

    const articleUrls = Array.from(
      $(".FlashNews-Item .FlashNews-Item-Text a")
    ).map(el => $(el).attr("href"));

    let queueCounter = 0;

    articleUrls
      .filter(url => !isCrawled(url))
      .filter(url => canVisit(url))
      .forEach(url => {
        ++queueCounter;

        crawler.queue({
          uri: url,
          callback: articleCallback
        });
      });

    console.log(`${queueCounter} enqueued from ${url}`);

    done();
  }
}

function articlesCallback(e, response, done) {
  const { $, request } = response;
  const url = request.uri.href;

  if (e) {
    error(e);

    done();
  } else {
    increment(url);

    const articleUrls = Array.from($(".article a.img-link")).map(el =>
      $(el).attr("href")
    );

    let queueCounter = 0;

    articleUrls
      .filter(url => !isCrawled(url))
      .filter(url => canVisit(url))
      .forEach(url => {
        ++queueCounter;

        crawler.queue({
          uri: url,
          callback: articleCallback
        });
      });

    console.log(`${queueCounter} enqueued from ${url}`);

    done();
  }
}

function setVisited(url) {
  return fs.createWriteStream(getHtmlOutPath(url)).write("");
}

function q(num) {
  return num < 10 ? "0" + num.toString() : num.toString();
}

function articleCallback(e, response, done) {
  const { $, request } = response;
  const url = request.uri.href;

  if (e) {
    error(e);

    done();
  } else {
    const author = getText($, $('[data-type="author"], .Article-Head-Author'));
    const date = getText($, $('[data-type="date"], .Article-Head-Date'));
    const title = getText($, $(".Article-Title, .Article-Head-Title"));
    const credits =
      []
        .concat(
          Array.from(
            $(".credits a[onclick=\"gaTrack('article', 'bottom', 'source');\"]")
          )
        )
        .concat(Array.from($(".Article-SourceItem a")))
        .map(el => $(el).attr("href"))
        .join(" ") || "";
    const timestamp = parseDate(date);

    if (!timestamp) {
      error(url, `timestamp:${timestamp}`);
      return done();
    }

    if (timestamp < new Date(2019, 9) || timestamp > new Date(2019, 10)) {
      setVisited(url);
      error(url, `out of timestamp`);
      return done();
    }

    const parsedDate = new Date(timestamp).toLocaleString("sk-SK");
    const year = new Date(timestamp).getFullYear();
    const month = new Date(timestamp).getMonth() + 1;
    const day = new Date(timestamp).getDate();
    const fileName = `${year}_${q(month)}_${q(day)}_${getId(url)}.jpeg`;

    if (!title || !date || !author) {
      error(url, [title, date, author].join(","));
      return done();
    }
    const obj = {
      timestamp,
      fileName,
      url,
      author,
      parsedDate,
      title,
      credits
    };

    if (!dev) {
      setVisited(url);

      db.push(`/${getId(url)}`, obj);

      ++writerCounter;

      increment(url);
    } else {
      console.log(obj);
    }

    done();
  }
}

(async () => {
  // DEVELOPMENT
  if (dev) {
    crawler.queue({
      uri:
        "https://filmkult.refresher.sk/14564-Joker-je-najzarobkovejsim-Rkovym-filmom-historie-a-splha-k-miliarde-Zombieland-2-prekona-trzby-jednotky-Box-Office",
      callback: articleCallback
    });
  } else {
    // first feed page
    crawler.queue({
      uri: "https://refresher.sk/news",
      callback: freshNewsCallback
    });

    // other feed pages
    new Array(FEED_PAGES).fill(null).forEach((_, index) => {
      const uri = `https://refresher.sk/news/${index + 1}`;

      crawler.queue({
        uri,
        callback: freshNewsCallback
      });
    });

    // home pages
    crawler.queue({
      uri: "https://refresher.sk",
      callback: articlesCallback
    });

    // other article pages
    new Array(ARTICLE_PAGES).fill(null).forEach((_, index) => {
      const uri = `https://refresher.sk/page/${index + 1}`;

      crawler.queue({
        uri,
        callback: articlesCallback
      });
    });
  }
})();
