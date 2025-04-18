var startLevel = parseInt(document.querySelector("#startingLevel").value)
var endLevel = parseInt(document.querySelector("#endingLevel").value)
var attribute = document.querySelector("#attributeSelector").value
var running = false
var prices = [[]]
let piece = "boots"
let types = ["aurora", "crimson", "fervor", "hollow", "terror"]
let useArmour = false
let result
let tempResultsInfo = [];
let saves = { ...localStorage };
let highlightedSave = undefined;

function showSaves() {

    document.querySelector("#savedThings").innerHTML = ""

    Object.keys(saves).forEach((save) => {
        let info = save.split("-")
        let saveText = document.createElement("p")
        saveText.classList.add("save")
        saveText.textContent = info[1]+" "+info[0]+" "+info[2]+" -> "+info[3]
        saveText.setAttribute("saveName", save)
        document.querySelector("#savedThings").appendChild(saveText)
        saveText.onclick = (e) => {
            let result = JSON.parse(saves[e.target.getAttribute("savename")])
            document.querySelector("#resultsContainer").innerHTML = ""
            renderResults(result, info[0])
            if (highlightedSave != undefined) {
                highlightedSave.style.background = "transparent"
                if (highlightedSave == e.target) {
                    if (confirm("Delete this save?")) {
                        localStorage.removeItem(e.target.getAttribute("savename"))
                        saves = { ...localStorage };
                        document.querySelector("#resultsContainer").innerHTML = ""
                        document.querySelector("#savedThings").removeChild(e.target)
                    }
                }
            }
            highlightedSave = e.target
            highlightedSave.style.background = "rgba(128, 128, 128, 0.5)"

        }
    })

}

showSaves()

const sleep = ms => new Promise(r => setTimeout(r, ms));

function formatNumber(num) {
    if (num >= 1_000_000_000) {
        return `${(num / 1_000_000_000).toFixed(2)}b`;
    } else if (num >= 1_000_000) {
        return `${(num / 1_000_000).toFixed(2)}m`;
    } else if (num >= 1_000) {
        return `${(num / 1_000).toFixed(2)}k`;
    } else {
        return num.toString();
    }
}

async function calculatePrices() {
    let progress = 0
    let finishedProgress = endLevel+(useArmour*5*endLevel)
    prices = [[]]
    for (var i = 0; i < endLevel; i++) {
        let level_prices = []
        if (useArmour) {
            for (let j = 0; j < 5; j++) {
                let armour_tag = (types[j]+"_"+piece).toUpperCase()
                console.log(armour_tag)
                let response = await fetch("https://sky.coflnet.com/api/auctions/tag/"+armour_tag+"/active/bin?"+attribute+"="+(i+1));
                console.log("https://sky.coflnet.com/api/auctions/tag/"+armour_tag+"/active/bin?"+attribute+"="+(i+1))
                let data;
                try {
                    data = await response.json()
                } catch (e) {
                    document.querySelector("#resultsContainer").innerHTML = progress+"/"+finishedProgress+": coflnet api request limit reached, continuing after 30 seconds"
                    await sleep(30000);
                    response = await fetch("https://sky.coflnet.com/api/auctions/tag/"+armour_tag+"/active/bin?"+attribute+"="+(i+1));
                    data = await response.json()
                    console.log(data)
                }
    
                level_prices = level_prices.concat(data.map(product => ({
                    "attributes": { [attribute]: i+1 },
                    "startingBid": product.startingBid,
                    "uuid": product.uuid,
                    "type": armour_tag
                })));

                progress++
                document.querySelector("#resultsContainer").innerHTML = "Requests made: "+progress+"/"+finishedProgress

            }
        }

        let data = await (await fetch("https://sky.coflnet.com/api/auctions/tag/ATTRIBUTE_SHARD/active/bin?"+attribute+"="+(i+1))).json();
        level_prices = level_prices.concat(data.map(product => ({
            "attributes": { [attribute]: i+1 },
            "startingBid": product.startingBid,
            "uuid": product.uuid,
            "type": "ATTRIBUTE_SHARD"
        })));
        progress++
        document.querySelector("#resultsContainer").innerHTML = "Requests made: "+progress+"/"+finishedProgress
        prices.push(level_prices)
    }
    prices[startLevel].push({
        "attributes": { [attribute]: startLevel },
        "startingBid": 0, 
        "uuid": "starting",
        "type": "starting_piece"
    });
    prices[startLevel].sort((a, b) => a.startingBid - b.startingBid);
}

function cost(l, prices, attribute,  stack=[]) {
    let rl = stack.slice()
    let shard;
    if (l == 1) {
        if (prices[1].length == 0) return []
        shard = prices[1].shift()
        rl.push(shard)
        return rl
    }
    let t1 = cost(l-1, prices, attribute, rl)
    let t2 = cost(l-1, prices, attribute, rl)
    let compareStack = t1.concat(t2);
    let ranOut = t1.length == 0 || t2.length == 0
    let noCurrent = prices[l].length == 0

    let sum = compareStack.reduce((acc, item) => acc + item.startingBid, 0)

    if (ranOut && !noCurrent) { 
        rl.push(prices[l].shift())
        compareStack.forEach((i) => {
            let tier = i["attributes"][attribute]
            prices[tier].push(i)
            prices[tier].sort((a, b) => a.startingBid - b.startingBid);
        })
        return rl
    } if (noCurrent && !ranOut) {
        return compareStack
    } if (noCurrent && ranOut) {
        return []
    } if (prices[l][0]["startingBid"] <= sum) {
        rl.push(prices[l].shift())
        compareStack.forEach((i) => {
            let tier = i["attributes"][attribute]
            prices[tier].push(i)
            prices[tier].sort((a, b) => a.startingBid - b.startingBid);
        })
        return rl
    }
    return compareStack
}

function copyAuctionId(string) {
    console.log(string)
    navigator.clipboard.writeText(string);
}

function renderResults(result, attribute) {
    let sum = result.reduce((acc, item) => acc + item.startingBid, 0)
    let sumElement = document.createElement("h2")
    sumElement.textContent = "Total Cost: "+formatNumber(sum)
    sumElement.classList.add("costSum")
    document.querySelector("#resultsContainer").appendChild(sumElement)
    result.forEach((book) => {
        let bookElement = document.createElement("h3")
        let tier = book["attributes"][attribute]
        bookElement.setAttribute("copyString", "/viewauction "+book.uuid)
        if (book.startingBid == 0) return;
        if (attribute == "mending") {
            bookElement.textContent = book["type"]+" /W VITALITY "+tier+" @"+(formatNumber(book.startingBid))+": "+"/viewauction "+book.uuid
        }else {
            bookElement.textContent = book["type"]+" /W "+attribute.toUpperCase()+" "+tier+" @"+(formatNumber(book.startingBid))+": "+"/viewauction "+book.uuid
        }
        let copybutton = document.createElement("button");
        let copyicon = document.createElement('i');
        copyicon.classList.add("ti")
        copyicon.classList.add("ti-copy")

        copybutton.addEventListener('click', (input) => {
            let node = input.target.parentElement
            if (node.tagName != "H3") node = node.parentElement;
            copyAuctionId(node.getAttribute("copyString"))
        })
        copybutton.appendChild(copyicon)
        bookElement.appendChild(copybutton)
        document.querySelector("#resultsContainer").appendChild(bookElement)
        document.querySelector("#resultsContainer").appendChild(document.createElement("br"))
    })
}

document.querySelector("#attributeSelector").addEventListener("change", (input) => {
    attribute = input.target.value
})

document.querySelector("#armourType").addEventListener("change", (input) => {
    piece = input.target.value
    console.log(piece)
})

document.querySelector("#useArmour").addEventListener("change", (input) => {
    useArmour = !useArmour
    if (useArmour) {
        document.querySelector("#armourType").style.visibility = "visible";
    } else {
        document.querySelector("#armourType").style.visibility = "hidden";
    }
})

document.querySelector("#startingLevel").addEventListener("input", (input) => {
    startLevel = parseInt(input.target.value)
    document.querySelector('#startingLevelDisplay').textContent =  'Starting Level: '+input.target.value
})

document.querySelector("#endingLevel").addEventListener("input", (input) => {
    endLevel = parseInt(input.target.value)
    document.querySelector('#endingLevelDisplay').textContent =  'Ending Level: '+input.target.value
})

document.querySelector("#calculateButton").onclick = async () => {
    if (endLevel <= startLevel) {alert("Invalid ending level!"); return false;}
    if (running == true) return false;
    running = true
    tempResultsInfo = []
    prices=  [[]];
    document.querySelector("#resultsContainer").innerHTML = ""
    await calculatePrices();
    result = await cost(endLevel, prices, attribute);
    let item = "attribute_shard"
    if (useArmour) {
        item = piece
    }
    tempResultsInfo = [attribute, item, startLevel, endLevel]
    result.sort((a, b) => a.startingBid - b.startingBid);
    document.querySelector("#resultsContainer").innerHTML = ""
    if (result.length == 0) {
        document.querySelector("#resultsContainer").innerHTML = "Could not find a way to reach desired level!"
    } else {
        renderResults(result, attribute)
    }
    running = false
}

let theme = "dark"

document.querySelector(".themeChanger").onclick = () => {
    if (theme == "dark") {
        console.log("hi")
        document.body.classList.remove("dark")
        document.querySelector("#inputSelectors").classList.remove("dark")
        document.querySelector("#attributeSelector").classList.remove("dark")
        document.querySelector("#calculateButton").classList.remove("dark")
        document.querySelector(".themeChanger").classList.remove("dark")
        document.querySelector("#armourType").classList.remove("dark")
        document.querySelector("#saveButton").classList.remove("dark")
        theme = "light"
    }
    else  {
        document.body.classList.add("dark")
        document.querySelector("#inputSelectors").classList.add("dark")
        document.querySelector("#attributeSelector").classList.add("dark")
        document.querySelector("#calculateButton").classList.add("dark")
        document.querySelector("#saveButton").classList.add("dark")
        document.querySelector(".themeChanger").classList.add("dark")
        document.querySelector("#armourType").classList.add("dark")
        theme = "dark"
    }
}

document.getElementById("saveButton").onclick = () => {
    if (tempResultsInfo.length == 0) {
        console.log("hi")
        alert("No data to be saved"); 
        return true;
    }
    localStorage.setItem(tempResultsInfo[0]+"-"+tempResultsInfo[1]+"-"+tempResultsInfo[2]+"-"+tempResultsInfo[3], JSON.stringify(result))
    saves = { ...localStorage }
    showSaves()
    
}