import fs from 'fs/promises';
import path from 'path';
import boxen from 'boxen';
import cheerio, { Cheerio, CheerioAPI, Element } from 'cheerio';
import Listr from 'listr';
import pino from 'pino';

type Context = {
  $: CheerioAPI;
  processedBookmarks: BookmarkList;
};

const logger = pino({
  prettyPrint: true,
});

const dataDirPath = path.join(process.cwd(), 'data');

const getBookmarks = async () => {
  const filepath = path.join(dataDirPath, 'GoogleBookmarks.html');
  try {
    return (await fs.readFile(filepath)).toString();
  } catch (err) {
    throw new Error(`Could not open Bookmarks from file ${filepath}`);
  }
};

const saveBookmarksToFile = async (content: BookmarkList) => {
  const filepath = path.join(dataDirPath, 'result.json');
  try {
    await fs.writeFile(filepath, JSON.stringify(content, null, 2));
  } catch (err) {
    throw new Error(`Could not create resulting JSON file ${filepath}`);
  }
};

const toDateObject = (dateStr?: string) =>
  dateStr ? new Date(Number(dateStr?.slice(0, -3))) : undefined;

const getDateProperties = ($el: Cheerio<Element>) => {
  const dateRaw = $el.attr('add_date');

  return {
    dateRaw,
    date: toDateObject(dateRaw),
  };
};

const processGroup = ($: CheerioAPI, $group: Cheerio<Element>) => {
  const $title = $('h3', $group);
  return {
    groupTitle: $title.text().trim(),
    ...getDateProperties($title),
    bookmarks: $('dl > dt > a', $group)
      .map((_, bookmark) => {
        const $bookmark = $(bookmark);
        return {
          title: $bookmark.text(),
          href: $bookmark.attr('href'),
          ...getDateProperties($bookmark),
        };
      })
      .toArray(),
  };
};

type BookmarkList = Array<ReturnType<typeof processGroup>>;

// Tasks

const tasks = new Listr([
  {
    title: 'Read bookmarks',
    task: async (ctx: Context) => {
      ctx.$ = cheerio.load(await getBookmarks());
    },
  },
  {
    title: 'Process bookmarks',
    task: (ctx: Context) => {
      const { $ } = ctx;
      ctx.processedBookmarks = $('body > dl > dt')
        .map((_, group) => processGroup($, $(group)))
        .toArray();
    },
  },
  {
    title: 'Save results',
    task: (ctx: Context) => saveBookmarksToFile(ctx.processedBookmarks),
  },
]);

// Start

console.log(
  boxen('Google Bookmarks 2 JSON', {
    borderStyle: 'single',
    dimBorder: true,
    margin: 1,
    padding: {
      bottom: 1,
      left: 5,
      right: 5,
      top: 1,
    },
    textAlignment: 'center',
  })
);

tasks.run().catch((err) => {
  logger.error(err);
});
