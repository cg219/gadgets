import { Select } from "@cliffy/prompt";
import { launch } from "jsr:@astral/astral";

const browser = await launch();
const proxy = "https://www.rarbgproxy.to";
const endpoint = "/search/";
const search = Deno.args[0];

try {
  const url = await loadResults();
  const magnet = await getMagnetUrl(url);
  console.log(magnet);

  await browser.close();
  Deno.exit(0);
} catch (e) {
  console.error(e);
  await browser.close();
  Deno.exit(0);
}

type ResultItem = {
  title: string;
  size: number;
  updatedAt: Date;
  url: string;
};

async function loadResults() {
  const url = new URL(proxy);

  url.pathname = endpoint;
  url.searchParams.set("search", search);

  const page = await browser.newPage(url.href, { headless: true });
  console.log(url.href);

  await page.waitForSelector(".table2ta_rarbgproxy");

  const rows = await page.$$(".table2ta_rarbgproxy");
  const res = await Promise.all(rows.map((row) => {
    return new Promise(async (res, rej) => {
      const columns = await row.$$(".tlista_rarbgproxy");
      const title = await columns[1].evaluate((el) =>
        el.querySelector("a").textContent
      );
      const date = toDate(await columns[3].evaluate((el) => el.textContent));
      const size = toMB(await columns[4].evaluate((el) => el.textContent));
      const link = await columns[1].evaluate((el) =>
        el.querySelector("a").getAttribute("href")
      );

      res({
        name: `${title} | ${date} (${size}MB)`,
        value: `${proxy}${link}`,
      });
    });
  }));

  return Select.prompt({
    message: "Choose",
    options: res,
  });
}

function toDate(dateTime: string): Date {
  return new Date(dateTime.replace(" ", "T"));
}

function toMB(data: string): number {
  const [amount, type] = data.split(" ");

  switch (type.toLowerCase()) {
    case "gb":
      return Number(amount) * 1024;
    case "kb":
      return Number(amount) / 1024;
    default:
      return Number(amount);
  }
}

async function getMagnetUrl(pageURL: string): Promise<string> {
  const url = new URL(pageURL);
  console.log(url.href);
  const page = await browser.newPage(url.href, { headless: true });

  await page.waitForTimeout(4000);

  const val = await page.evaluate(() => {
    return document.querySelector("table.tlista_rarbgproxy").querySelector(".tlista_rarbgproxy")?.querySelectorAll("a")[1].getAttribute("href")
  });

 // await Deno.writeTextFile("test.html", await page.content());
  return val ;
}
