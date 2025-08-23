import { readdirSync, statSync } from 'fs';
import { join } from 'path';

function parseHighlightFilename(filename) {
  const regex = /^([A-Za-z]+)\s(\d+K)\s(.+?)_(\d{2}-\d{2}-\d{2})_(\d{2}-\d{2}-\d{2})\.mp4$/;
  const match = filename.match(regex);

  if (match) {
    const [, hero, kills, gamemode, date, time] = match;
    return {
      originalFilename: filename,
      hero: hero,
      kills: kills,
      gamemode: gamemode,
      date: date,
      time: time,
      isValid: true,
    };
  } else {
    return {
      originalFilename: filename,
      isValid: false,
      error: 'Filename does not match expected format.',
    };
  }
}

function generateHighlightHtml(highlight, gameName) {
  if (highlight.isValid) {
    const videoPath = `/${gameName}/${highlight.originalFilename}`;

    return `
      <div class="bg-white rounded-lg shadow-md p-5 border border-gray-200">
        <p class="text-sm text-gray-500 mb-1">Game: <span class="font-medium text-gray-600">${gameName}</span></p>
        <h2 class="text-xl font-semibold mb-2 text-blue-700">${highlight.hero}</h2>
        <p class="text-gray-700 mb-1">Kills: <span class="font-bold text-red-600">${highlight.kills}</span></p>
        <p class="text-gray-700 mb-1">Gamemode: <span class="font-medium">${highlight.gamemode}</span></p>
        <p class="text-gray-700 mb-3">Date: ${highlight.date.replace(/-/g, '/')} at ${highlight.time.replace(/-/g, ':')}</p>
        
        <div class="relative w-full aspect-video mb-4 rounded-md overflow-hidden">
          <video class="w-full h-full object-cover" src="${videoPath}" autoplay loop muted playsinline></video>
        </div>

        <a href="${videoPath}" target="_blank" rel="noopener noreferrer" class="block w-full text-center">
          <button class="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-md shadow-md transition duration-300 ease-in-out text-lg w-full">
            View Video
          </button>
        </a>

        <p class="text-sm text-gray-500 break-words mt-3" data-filename="${highlight.originalFilename}">
          Filename: <code>${highlight.originalFilename}</code>
        </p>
      </div>
    `;
  } else {
    return `
      <div class="bg-red-50 rounded-lg shadow-md p-5 border border-red-200">
        <p class="text-sm text-gray-500 mb-1">Game: <span class="font-medium text-gray-600">${gameName}</span></p>
        <h2 class="text-xl font-semibold mb-2 text-red-700">Invalid Filename</h2>
        <p class="text-gray-700 mb-1">This file could not be parsed:</p>
        <p class="text-sm text-gray-500 break-words" data-filename="${highlight.originalFilename}">
          Filename: <code>${highlight.originalFilename}</code>
        </p>
        <p class="text-sm text-red-500 mt-2">${highlight.error}</p>
      </div>
    `;
  }
}

export default function handler(request, response) {
  const gameParam = request.query.game;
  const publicPath = join(process.cwd(), 'public');
  let allHighlightsHtml = '';
  let title = '';

  try {
    if (gameParam) {
      const gameDirectoryPath = join(publicPath, gameParam);
      const stats = statSync(gameDirectoryPath);

      if (!stats.isDirectory()) {
        return response.status(404).send(`Not Found: Directory for game "${gameParam}" does not exist.`);
      }

      const files = readdirSync(gameDirectoryPath)
        .filter(file => file.endsWith('.mp4'));

      const highlights = files.map(file => parseHighlightFilename(file));
      title = `Highlights for ${gameParam}`;

      highlights.forEach(highlight => {
        allHighlightsHtml += generateHighlightHtml(highlight, gameParam);
      });

    } else {
      const gameDirs = readdirSync(publicPath, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name);

      title = 'All Game Highlights';

      gameDirs.forEach(gameName => {
        const gameDirectoryPath = join(publicPath, gameName);
        const files = readdirSync(gameDirectoryPath)
          .filter(file => file.endsWith('.mp4'));

        const highlights = files.map(file => parseHighlightFilename(file));
        highlights.forEach(highlight => {
          allHighlightsHtml += generateHighlightHtml(highlight, gameName);
        });
      });
    }

    const htmlResponse = `
      <div class="p-6">
        <h1 class="text-3xl font-bold mb-6 text-gray-800 rounded-md">${title}</h1>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          ${allHighlightsHtml}
        </div>
      </div>
    `;

    response.setHeader('Content-Type', 'text/html');
    response.status(200).send(htmlResponse);

  } catch (error) {
    console.error(`Error fetching highlights:`, error);
    if (error.code === 'ENOENT') {
      response.status(404).send(`Not Found: The specified game directory was not found or there are no game directories in 'public'.`);
    } else {
      response.status(500).send(`Internal Server Error: Could not retrieve highlights. Error: ${error.message}`);
    }
  }
}
