const fs = require('fs');
const md5 = require('md5');
const Promise = require('bluebird');
const moment = require('moment');
const qs = require('querystring');
const scrap = require('./scrap');
//
const delay = 1000;
const timeout = 120000;
const indexUrl = 'http://kateglo.com';
const ts = function () {
    return moment().format('YYYY-MM-DD hh:mm:ss');
};
const saveFile = function (list) {
    list.forEach(function (el) {
        el.url = `http://kateglo.com/api.php?format=json&phrase=${encodeURIComponent(el.text)}`;
        el.detailed = false;
        el.tags = el.tags || [];
        fs.writeFileSync('./data/' + md5(el.text) + '.txt', JSON.stringify(el, 0, 2));
    });
};
const getList = function ($, param) {
    let list = [];
    let selector = {
        text: '.dl-horizontal dt',
        tags: '.dl-horizontal dd'
    };

    delete param.p;

    for (let key in selector) {
        let element = $(selector[key]);
        element.each(function (i, child) {
            let el = $(child);
            list[i] = list[i] || Object.assign({}, param || {}, {text: null, tags: null, url: null, related: []});
            //
            if (key === 'tags') {
                el.children().each(function (j, child) {
                    let kinda = $(child).text();
                    if (child.name === 'span') {
                        list[i][key] = list[i][key] || {};
                        list[i][key][kinda] = list[i][key][kinda] || [];
                        if (child.next.type === 'text') {
                            if (child.next.data.trim() && (child.next.data.trim().length > 1)) {
                                list[i][key][kinda].push({
                                    type: 'desc',
                                    text: child.next.data.trim()
                                });
                            }
                        }
                    } else if (child.name === 'b') {
                        let myKeys = Object.keys(list[i][key]);
                        let ii = myKeys[myKeys.length - 1];
                        if (child.next) {
                            if (child.next.type === 'text' && child.next.data.trim().length > 1) {
                                list[i][key][ii].push({
                                    type: 'desc',
                                    text: child.next.data.trim()
                                });
                            }
                        }
                    } else if (child.name === 'i') {
                        let myKeys = Object.keys(list[i][key]);
                        let ii = myKeys[myKeys.length - 1];
                        if (child.next) {
                            if (child.next.type === 'text' && child.next.data.trim().length > 1) {
                                list[i][key][ii].push({
                                    type: 'desc',
                                    text: kinda + ' ' + child.next.data.trim()
                                });
                            }
                        }
                    } else if (child.name === 'a') {
                        if (list[i].tags) {
                            let myKeys = Object.keys(list[i][key]);
                            let ii = myKeys[myKeys.length - 1];
                            list[i][key][ii].push({
                                type: 'link',
                                text: kinda
                            })
                        } else {
                            list[i].related.push(kinda);
                        }
                    }
                });
            } else {
                list[i][key] = el.find('a').text();
            }
        });
    }
    //
    return list;
};
const getIndex = async function (params) {
    let fistWord, pageFlag = '.pagination.pagination-sm span';
    //
    let pages = {};
    let fn = async function (p = 1) {
        let param = Object.assign({mod: 'dictionary', p}, params);
        let query = qs.stringify(param);
        let uri = indexUrl + '/?' + query;

        console.log(ts(), 'Getting index from:', uri);
        await Promise.delay(delay);

        try {
            let $ = await scrap({uri, timeout});
            let list = getList($, param.idx ? {} : param);

            fistWord = fistWord || list[0].text;
            if (!(p > 1 && list[0].text.toLowerCase() === fistWord.toLowerCase())) {
                let entries = $(pageFlag)[0];
                let total = $(entries).text().split(/\sdari\s|\sentri/g)[1];

                pages[p] = list.length;
                if (parseInt(total) !== list.length) {
                    saveFile(list);
                    return fn(p + 1);
                }
            }

            saveFile(list);
            return pages;
        } catch (e) {
            console.log(ts(), 'ERR!', uri);
            console.log(ts(), e);
        }
    };
    return fn();
};
//
(async function () {
    /*const abjads = `-qwertyuiopasdfghjklzxcvbnm`;
    const indexes = abjads.split('');
    for (let e in indexes) {
        let idx = indexes[e];
        let pages = await getIndex({idx});
        console.log('>>', JSON.stringify({idx, pages}));
    }*/
    //
    const types = [
        {type: 'a', type_desc: 'imbuhan'},
        {type: 'r', type_desc: 'kata dasar'},
        {type: 'd', type_desc: 'kata turunan'}
    ];
    for (let f in types) {
        let type = types[f];
        let pages = await getIndex(type);
        console.log('>>', JSON.stringify({type, pages}));
    }
    process.exit(0);
})();
