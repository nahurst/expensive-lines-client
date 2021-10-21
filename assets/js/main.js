---
---

import { BigNumber, ethers } from "./ethers-5.2.esm.min.js";
import { abi } from "./abi.js";
import util from "./util.js";

const MAX_LINES = 50;
const MAX_ARTWORKS = 4000;
const svg = document.querySelector('#main svg');
const seenEvents = {};
let totalCost = BigNumber.from('0');
const throttleQueue = [];
let pageArtworkId, ethToUSD, leaderEvents, grantEvents, lineEvents;

const statusArtworkId = document.querySelector('#status #artworkId');
const statusCost = document.querySelector('#status #cost');
const statusLineCount = document.querySelector('#status #lineCount');
const statusLeadArtist = document.querySelector('#status #leadArtist');
const statusGrantee = document.querySelector('#status #grantee');
const statusState = document.querySelector('#status #state');
const statusLinesByLeader = document.querySelector('#status #linesByLeader');

const contractAddress = '{{ site.env.ETHEREUM_CONTRACT }}';
{% if site.env.ETHEREUM_NETWORK == 'local' %}
const provider = new ethers.providers.JsonRpcProvider();
{% else %}
const provider = new ethers.providers.InfuraProvider('{{ site.env.ETHEREUM_NETWORK }}');
{% endif %}
const contract = new ethers.Contract(contractAddress, abi, provider);

const eventToFn = {
  'LineAdded': addLine,
  'LeaderChanged': changeLeader,
  'Transfer': grantNFT
}

export default function run() {
  recordEthToUSD();
  setupThrottleQueue();

  const currentPath = window.location.pathname;
  if (currentPath.includes('artwork')) {
    const urlParams = new URLSearchParams(window.location.search);
    pageArtworkId = parseInt(urlParams.get('id')); 
    boot();
  } else if (currentPath.includes('practice')) {
    setupPractice();
  } else {
    pageArtworkId = 0;
    boot();
  }
}

async function recordEthToUSD() {
  const data = await fetch('https://api.coinbase.com/v2/exchange-rates?currency=ETH');
  const json = await data.json();
  ethToUSD = parseFloat(json.data.rates.USD);
}

function setupThrottleQueue() {
  setInterval(() => {
    const nextFn = throttleQueue.shift()
    if (nextFn) nextFn()
  }, 300)
}
function throttle(fn) {
  throttleQueue.push(fn)
}

async function boot() {
  if (pageArtworkId < 0 || pageArtworkId >= MAX_ARTWORKS) {
    statusState.textContent = 'Artwork does not exist.'
    return;
  }

  statusArtworkId.textContent = `#${pageArtworkId}`;
  statusState.textContent = 'No lines yet';
  totalCost = BigNumber.from('0');
  statusGrantee.textContent = 'Nobody yet';

  leaderEvents = await contract.queryFilter(contract.filters.LeaderChanged(pageArtworkId));
  grantEvents = await contract.queryFilter(contract.filters.Transfer(null, null, pageArtworkId));
  lineEvents = await contract.queryFilter(contract.filters.LineAdded(pageArtworkId));
  
  setPreviews();
  
  await replayHistorical();
  
  const inProgress = grantEvents.length <= 0;
  if (inProgress) {
    Object.entries(eventToFn).forEach(([event, fn]) => {
      contract.on(event, fn);
    });
  }
}

async function replayHistorical() {
  
  if (lineEvents.length > 0) {
    const maxLineEvent = lineEvents.reduce((prev, current) => {
      if (current.args.lineCount > prev.args.lineCount) {
          return current;
      } else {
          return prev;
      }
    });
    
    const eventsToReplay = [maxLineEvent, ...leaderEvents, ...grantEvents];
    replayLogs(eventToFn, eventsToReplay);
  } else {
    const eventsToReplay = [...leaderEvents, ...grantEvents];
    replayLogs(eventToFn, eventsToReplay);
  }
  
  const eventsToCost = [...lineEvents];
  for (let log of eventsToCost) {
    throttle(() => increaseTotalCostBy(log));
  }
}

function replayLogs(replayers, logs) {
  logs.forEach((log) => {
    if (replayers[log.event]) {
      const replayer = replayers[log.event];
      replayer(...log.args, log, false);
    }
  });
}

async function setPreviews() {
  const maxPreview = Math.min(pageArtworkId + 13, MAX_ARTWORKS);
  for (let i = pageArtworkId + 1; i < maxPreview; i++) {
    await createPreview(i); 
    await delay(500);
  }
}

const delay = ms => new Promise(res => setTimeout(res, ms));

async function createPreview(artworkId) {
  const nextResultURI = await contract.tokenURI(artworkId);
  const { svgString } = parseTokenURI(nextResultURI);
  if (svgString.includes('line')) {
    document.querySelector('h2#nextArtworksHeading')
      .classList.remove('invisible');
    const svgDiv = document.createElement('div');
    svgDiv.className = 'border-2 border-gray-500 bg-white';

    const link = document.createElement('a');
    link.href = `/artwork?id=${artworkId}`;
    link.innerHTML = svgString;

    svgDiv.appendChild(link);
    nextArtworks.appendChild(svgDiv);
  }
}

// Make sure to throttle this - it is a separate call that happens outside normal logs that are
// a bit more naturally rate limited due to scoping at to a specific artwork.
async function increaseTotalCostBy(log) {
  const additionalCost = await costFor(log);

  totalCost = totalCost.add(additionalCost);

  const costEther = parseFloat(ethers.utils.formatEther(totalCost)).toFixed(5);
  if (ethToUSD > 0) {
    const costUSD = (costEther * ethToUSD).toFixed(2);
    statusCost.textContent = `${costEther} Ether (\$${costUSD})`;
  } else {
    statusCost.textContent = `${costEther} Ether`;
  }
}

async function costFor(log) {
  const transaction = await log.getTransaction();
  const receipt = await log.getTransactionReceipt();
  const cost = util.transactionCostInWei(receipt.gasUsed, transaction.gasPrice, transaction.value);

  return cost;
}

function addLine(artworkId, lineCount, linesByLeader, log, live=true) {
  console.log('LineAdded', artworkId, lineCount, linesByLeader);
  if (+artworkId !== pageArtworkId) {
    return;
  }
  
  if (lineCount < MAX_LINES) {
    statusState.textContent = 'In progress';
  } else if (lineCount === MAX_LINES) {
    statusState.textContent = 'In grant period';
  }

  // Lines are drawn by just refreshing the svg from tokenuri and this happens after all initial lines are processed
  refreshArtwork(artworkId);

  statusLineCount.textContent = `${lineCount} of ${MAX_LINES}`;
  statusLinesByLeader.textContent = linesByLeader;
  if (live) {
    throttle(() => increaseTotalCostBy(log));
  }
}

function changeLeader(artworkId, leader, lines, log, live=false) {
  console.log('LeaderChanged', artworkId, leader, lines);
  if (+artworkId !== pageArtworkId) {
    return;
  }

  statusLeadArtist.textContent = leader;
}

async function grantNFT(from, to, artworkId, log, live=false) {
  console.log('Transfer', artworkId.toString(), to);
  if (+artworkId !== pageArtworkId) {
    return;
  }

  statusGrantee.textContent = to;
  statusState.textContent = 'Completed';

  if (live) {
    throttle(() => increaseTotalCostBy(log));
  }

  // We expect the last line to have refreshed the artwork.
}

async function refreshArtwork(artworkId) {
  console.log('Refreshing artwork');

  const resultURI = await contract.tokenURI(parseInt(artworkId));
  const { svgString } = parseTokenURI(resultURI);
  updateSvg(svgString);
}

function parseTokenURI(tokenURI) {
  const tokenURIJson = JSON.parse(atob(tokenURI.substr('data:application/json;base64,'.length)));
  const svgString = atob(tokenURIJson.image.substr('data:image/svg+xml;base64,'.length));
  tokenURIJson.svgString = svgString;

  return tokenURIJson;
}

function updateSvg(svgString) {
  const replacement = svgString
    .replace('<svg xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMinYMin meet" viewBox="0 0 255 255">', '')
    .replace('</svg>', '');
  svg.innerHTML = replacement;
}

function setupPractice() {
  const pt = svg.createSVGPoint();  // Created once for document

  svg.addEventListener('click', showCommand);

  let lastClick, thisClick;

  function showCommand(evt) {
    if (!lastClick) {
      lastClick = clickToXY(evt);
      return;
    }

    thisClick = clickToXY(evt);

    const colorStr = document.querySelector('#color').value;
    const [r,g,b] = colorStr.replace(/\s+/g, '').split(',').map((i) => parseInt(i));

    const line = document.createElementNS('http://www.w3.org/2000/svg','line');
    line.setAttribute('x1', lastClick.x);
    line.setAttribute('y1', lastClick.y);
    line.setAttribute('x2', thisClick.x);
    line.setAttribute('y2', thisClick.y);
    line.setAttribute('stroke', `rgb(${r}, ${g}, ${b})`);
    line.setAttribute('stroke-width', 10);
    svg.append(line);

    const output = document.querySelector('#status > div');
    const command = document.createElement('p');
    command.textContent = `draw(artworkId, ${lastClick.x}, ${lastClick.y}, ${thisClick.x}, ${thisClick.y}, ${r}, ${g}, ${b})`;
    output.appendChild(command);
    
    lastClick = undefined;
  }

  function clickToXY(evt) {
    pt.x = evt.clientX;
    pt.y = evt.clientY;

    // The cursor point, translated into svg coordinates
    const cursorPt =  pt.matrixTransform(svg.getScreenCTM().inverse());
    const x = Math.floor(cursorPt.x);
    const y = Math.floor(cursorPt.y);

    return {x, y};
  }
}