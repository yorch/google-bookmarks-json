import fs from 'fs/promises';
import path from 'path';
import cheerio, { Cheerio, CheerioAPI, Element } from 'cheerio';
import pino from 'pino';

const logger = pino({
  prettyPrint: true,
});

const dataDirPath = path.join(process.cwd(), 'data');

const getBookmarks = async () => {
  const filename = 'GoogleBookmarks.html';
  const filepath = path.join(dataDirPath, filename);
  try {
    logger.info(`Reading bookmarks from file ${filepath}`);

    const file = await fs.readFile(filepath);

    logger.info('Successfully read bookmarks!');

    return file.toString();
  } catch (err) {
    throw new Error(`Could not open ${filepath}`);
  }
};

const saveBookmarksToFile = async (content: BookmarkList) => {
  try {
    const filepath = path.join(dataDirPath, 'result.json');

    logger.info(`Saving bookmarks to ${filepath}`);

    await fs.writeFile(filepath, JSON.stringify(content, null, 2));

    logger.info(`Bookmarks successfully saved!`);
  } catch (err) {
    throw new Error('Could not create resulting JSON file');
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

(async () => {
  const $ = cheerio.load(await getBookmarks());

  const bookmarks = $('body > dl > dt')
    .map((_, group) => processGroup($, $(group)))
    .toArray();

  await saveBookmarksToFile(bookmarks);

  logger.info('Done!');
})().catch((err) => {
  logger.error(err.toString());
});
