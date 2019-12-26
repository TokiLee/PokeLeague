// Richard Lee
// API Project
// Topic: Picking a sword/shield pokemon starter based on your league of legends match history

const http = require('http');
const https = require('https');
const fs = require('fs');
const url = require('url');
const querystring = require('querystring');
const api = require('./data/apiAddress.json');
const starterPokemon = require('./data/starterPokemonId.json');

const requestListener = function (req, res) {
    console.log('request was made: ' + req.url);

    // root
    // return search-form
    if (req.url === '/') {
        res.writeHead(200);
        const readStream = fs.createReadStream('./html/search-form.html', "utf8");
        readStream.pipe(res);
        // res.end();
    }

    // favicon
    // don't need to return favicon so return 404
    if (req.url.startsWith('/favicon.ico')) {
        res.writeHead(404);
        res.end();
    }

    // img
    if (req.url.startsWith('/images')) {

        const imageStream = fs.createReadStream('.' + req.url);

        imageStream.on('open', function () {
            imageStream.pipe(res);
        })

        imageStream.on('error', function (err) {
            console.log(err);
            res.writeHead(404);
            return res.end();
        });
    }

    if (req.url.startsWith('/search')) {
        const search = url.parse(req.url, true);
        const userInput = search.query.q;

        // Getting encrypted summoner ID to later pass into 

        // gets encrypted summoner id from your user name
        const getSumId = function () {
            https.get(api.api + api.getSumID + userInput + '?api_key=' + api.key, resp => {
                let data = '';

                resp.on('data', chunk => {
                    data += chunk;
                });

                resp.on('end', () => {
                    let accountData = JSON.parse(data);
                    let accountId = accountData.accountId;
                    getMatchData(accountId);
                })
            });
        }

        // gets the last 20 matches played on your account
        const getMatchData = function (accountId) {
            https.get(api.api + api.getMatchList + accountId + '?endIndex=20&api_key=' + api.key, resp => {
                let data = '';

                resp.on('data', chunk => {
                    data += chunk;
                });

                resp.on('end', () => {
                    let matchData = JSON.parse(data);
                    let matchChampions = []
                    matchData.matches.forEach(e => {
                        matchChampions.push(e.champion);
                    });
                    getChampionData(matchChampions);
                })
            });
        }

        // gets the champion data from your last 20 played champions
        const getChampionData = function (matchChampions) {
            http.get(api.championData, resp => {
                let data = '';

                resp.on('data', chunk => {
                    data += chunk;
                });

                resp.on('end', () => {
                    let championData = JSON.parse(data);
                    let matchChampionData = matchChampions.map(id => {
                        for (let champion in championData.data) {
                            if (id == championData.data[champion].key)
                                return championData.data[champion];
                        }
                    });

                    let starterData = [];
                    let count = 0;
                    getPokemonData(starterData, count, matchChampionData)
                });
            });
        }

        // get the starter pokemon data from ultra sun / ultra moon games
        const getPokemonData = function (starterData, count, matchChampionData) {
            https.get(api.pokemonData + starterPokemon.starterId[count], resp => {
                let data = '';

                resp.on('data', chunk => {
                    data += chunk;
                });

                resp.on('end', () => {
                    let pokemonData = JSON.parse(data);
                    starterData.push(pokemonData);
                    if (starterData.length < 3) {
                        count++;
                        getPokemonData(starterData, count, matchChampionData);
                    } else {
                        calculate(starterData, matchChampionData);
                    }
                });
            })
        }

        // calculate which pokemon has which tags && matches your highest played champion type with a pokemon
        const calculate = function (starterData, matchChampionData) {
            console.log(matchChampionData);

            championTag = {
                Assassin: 0,
                Fighter: 0,
                Mage: 0,
                Marksman: 0,
                Support: 0,
                Tank: 0
            }

            imageList = []

            for (let i = 0; i < matchChampionData.length; i++) {
                imageList.push(matchChampionData[i].id);
                // console.log(matchChampionData);
                for (let j = 0; j < matchChampionData[i].tags.length; j++) {
                    for (let tag in championTag) {
                        if (tag === matchChampionData[i].tags[j])
                            championTag[tag]++;
                    }
                }
            }
            // sort tags by count and stores them in sortedTag
            let sortedTag = []
            for (let tag in championTag) {
                sortedTag.push([tag, championTag[tag]]);
            }

            sortedTag.sort(function (a, b) {
                return a[1] - b[1];
            });
            let starterStats = [
                [],
                [],
                []
            ]

            // gets base stats for each pokemon
            for (let i = 0; i < starterStats.length; i++) {
                for (let j = 0; j < starterData[i].stats.length; j++) {
                    starterStats[i].push(starterData[i].stats[j].base_stat);
                }
            }
            let tags = ['Assassin', 'Support', 'Mage', 'Tank', 'Marksman', 'Fighter'];

            let starterTags = [
                [],
                [],
                []
            ]

            // console.log(starterStats);
            // determine which starter get which tag based on base stats
            /*
            speed = assassin
            special def = support
            special atk = mage
            def = tank
            attack = marksman
            hp = fighter
            */
            for (let i = 0; i < starterStats[0].length; i++) {
                let starter = 0;
                let max = starterStats[0][i];
                for (let j = 1; j < starterStats.length; j++) {
                    if (max < starterStats[j][i]) {
                        max = starterStats[j][i];
                        starter = j;
                    }
                }
                starterTags[starter].push(tags[i])
            }

            // console.log(sortedTag[5]);
            let chosenOne;
            for (let i = 0; i < starterTags.length; i++) {
                for (let j = 0; j < starterTags[i].length; j++) {
                    if (starterTags[i][j] === sortedTag[5][0])
                        chosenOne = starterPokemon.starterId[i];
                }
            }

            imageList.forEach(champion => {
                downloadImage(champion, imageList.length, chosenOne)
            });
        }

        let downloadedImages = 0;
        let imagePathArray = []
        const downloadImage = function (champion, listLength, chosenOne) {
            const imgPath = './images/' + champion + '.png';
            fs.access(imgPath, fs.constants.F_OK, (err) => {
                if (err) {
                    let imageReq = http.get(api.championImg + champion + '.png', function (imageRes) {
                        let newImg = fs.createWriteStream(imgPath, {
                            'encoding': null
                        });
                        imageRes.pipe(newImg);
                        newImg.on('finish', function () {
                            downloadedImages++;
                            imagePathArray.push(imgPath);
                            if (downloadedImages === listLength) {
                                // download pokemon
                                downloadPokemon(chosenOne, imagePathArray);
                            }
                        });
                    });
                    imageReq.on('error', function (err) {
                        console.log(err);
                    });
                } else {
                    console.log('dl already');
                    downloadedImages++;
                    imagePathArray.push(imgPath);
                    if (downloadedImages === listLength) {
                        // download pokemon
                        downloadPokemon(chosenOne, imagePathArray);
                    }
                }
            })
        }

        const downloadPokemon = function (pokemon, imagePathArray) {
            console.log('you are here');
            let pokeImgPath = './images/' + pokemon + '.png';
            console.log(pokeImgPath);
            fs.access(pokeImgPath, fs.constants.F_OK, (err) => {
                if (err) {
                    let imgReq = https.get(api.pokemonImg + pokemon + '.png', function (imgRes) {
                        let newPokeImg = fs.createWriteStream(pokeImgPath, {
                            'encoding': null
                        });
                        imgRes.pipe(newPokeImg);
                        newPokeImg.on('finish', function () {
                            generateWebpage(imagePathArray, pokeImgPath);

                        });
                    });
                    imgReq.on('error', function (err) {
                        console.log(err);
                    });
                } else {
                    generateWebpage(imagePathArray, pokeImgPath);

                }
            });
            // downloaded pokemon then make webpage
        }

        const generateWebpage = function (imagePathArray, pokeImgPath) {
            console.log('here');
            let imgs = imagePathArray.map(x => "<img src=\"" + x + "\">");

            res.writeHead(200, {
                'Content-Type': 'text/html'
            });

            res.write(
                "<!DOCTYPE html>\n" +
                "<html lang=\"en\">\n" +
                "<head>\n" +
                "<title>Match history of - " + userInput + "</title>\n" +
                "<style>*{font-size: 36pt;}</style>\n" +
                "</head>\n" +
                "<body>\n" +
                "<h1>Last 20 champions played: " + userInput + "</h1>\n" +
                imgs.join('') + "\n" +
                "<h1>Pokemon Chosen:</h1>\n" +
                "<img src=\"" + pokeImgPath + "\">\n" +
                "</body>\n" +
                "</html>"
            );

            res.end();
        }

        getSumId();
    }
}

const server = http.createServer(requestListener);
server.listen(3000, 'localhost');