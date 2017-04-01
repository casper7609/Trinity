var catalogVersion = "0.9";
var LVL_UP_PAC = "LVL_UP_PAC";
var MON_SUB_PAC = "MON_SUB_PAC";
var UserInventoryMax = 20;
var enchantPriceInIP = 10;
var spDefault = 10;
var slDefault = 10;
var cpDefault = 10;
var lpDefault = 20;
function rand(from, to) {
    return Math.floor((Math.random() * to) + from);
}
handlers.PurchaseCharacter = function (args) {
    log.info("PlayFabId " + currentPlayerId);
    log.info("ClassType " + args.ClassType);
    log.info("ClassStatus " + args.ClassStatus);
    var classType = args.ClassType;

    var gemPrice = args.GemPrice;
    log.info("gemPrice " + gemPrice);
    var allChars = server.GetAllUsersCharacters({
        "PlayFabId": currentPlayerId
    });
    var userInv = server.GetUserInventory({
        "PlayFabId": currentPlayerId
    });
    var currentGem = userInv.VirtualCurrency.GP;
    if (currentGem < gemPrice) {
        return { "Error": "Insufficient Gem" };
    }
    if (gemPrice > 0) {
        server.SubtractUserVirtualCurrency(
            {
                "PlayFabId": currentPlayerId,
                "VirtualCurrency": "GP",
                "Amount": gemPrice
            }
        );
    }

    var grantCharResult = server.GrantCharacterToUser({
        "PlayFabId": currentPlayerId,
        "CatalogVersion": catalogVersion,
        "CharacterName": classType,
        "CharacterType": classType,
        "ItemId": classType
    });
    var characterId = grantCharResult.CharacterId;
    log.info("characterId " + characterId);
    var classStatus = JSON.parse(args.ClassStatus);
    var luck = classStatus["Luck"];
    delete classStatus.Luck;
    server.UpdateCharacterData({
        "PlayFabId": currentPlayerId,
        "CharacterId": characterId,
        "Data": classStatus
    });
    var isActive = allChars.Characters.length <= 1;
    var isLeader = allChars.Characters.length == 0;
    server.UpdateCharacterData({
        "PlayFabId": currentPlayerId,
        "CharacterId": characterId,
        "Data": { "Luck": luck, "IsActive": isActive, "IsLeader": isLeader, "Level": 0}
    });
    server.UpdateCharacterData({
        "PlayFabId": currentPlayerId,
        "CharacterId": characterId,
        "Data": { "SoulAttackLevel": 0, "SoulHitPointLevel": 0 }
    });
    var itemId = "";
    if (classType == "Rogue") {
        itemId = "Dagger_00";
    }
    else if (classType == "Hunter") {
        itemId = "Bow_00";
    }
    else if (classType == "Warrior" || classType == "SpellSword" || classType == "Paladin") {
        itemId = "TwoHandSword_00";
    }
    else if (classType == "Sorcerer" || classType == "Warlock" || classType == "Priest") {
        itemId = "Staff_00";
    }

    log.info("itemId " + itemId);
    var grantItemResult = server.GrantItemsToCharacter({
        "Annotation": "Char Creation Basic Item",
        "CatalogVersion": catalogVersion,
        "PlayFabId": currentPlayerId,
        "CharacterId": characterId,
        "ItemIds": [itemId]
    });
    log.info("grantItemResult " + JSON.stringify(grantItemResult));
    return { "CharacterId": characterId };
};
handlers.KilledMob = function (args)
{
    var mobType = args.MobType;
    var townLevel = parseInt(args.TownLevel);
    var dungeonLevel = parseInt(args.DungeonLevel) + 1;
    var x = (townLevel * 100 + dungeonLevel);
    var sl = 0;
    var sp = 0;
    var cp = 0;
    var userInventory = server.GetUserInventory({
        "PlayFabId": currentPlayerId
    });
    var items = [];
    var realItems = [];
    var invMax = UserInventoryMax;
    var userData = server.GetUserData(
        {
            "PlayFabId": currentPlayerId,
            "Keys": [
                "UserInventoryMax"
            ]
        }
    );
    if (userData.UserInventoryMax && userData.UserInventoryMax.Value)
    {
        invMax = (userData.UserInventoryMax.Value);
    }
    if (userInventory.Inventory.length < invMax)
    {
        var townId = "Town_" + args.TownLevel;
        var townItem = server.EvaluateRandomResultTable(
            {
                "CatalogVersion": catalogVersion,
                "PlayFabId": currentPlayerId,
                "TableId": townId
            }
        );
        if (townItem.ResultItemId != "Nothing") {
            log.info("item " + JSON.stringify(townItem));
            items.push(townItem.ResultItemId);
        }
        if (items.length > 0) {
            var itemGrantResult = server.GrantItemsToUser(
                {
                    "CatalogVersion": catalogVersion,
                    "PlayFabId": currentPlayerId,
                    "ItemIds": items
                }
            );
            realItems = realItems.concat(itemGrantResult["ItemGrantResults"]);
            //add random stat here
            for (var i = 0; i < itemGrantResult.length; i++) {
                //var arr = []
                //while(arr.length < 3){
                //    var randomnumber = rand(0, 7);
                //    if(arr.indexOf(randomnumber) > -1) continue;
                //    arr[arr.length] = randomnumber;
                //}
                server.UpdateUserInventoryItemCustomData({
                    PlayFabId: currentPlayerId,
                    CharacterId: characterId,
                    ItemInstanceId: itemToEnchant.ItemInstanceId,
                    Data: { "Enchant": 0, "Strength": 10, "Dexterity": 10 },
                });
            }
        }
    }
    //if normal
    if (mobType == "Normal")
    {
        sl = Math.floor(slDefault + 10000 * x / (x + 20000));
        server.AddUserVirtualCurrency(
            {
                "PlayFabId": currentPlayerId,
                "VirtualCurrency": "SL",
                "Amount": sl
            }
        );
    }
    else if (mobType == "NormalBoss")
    {
        sp = 1;
        //if normal boss(Boss)
        server.AddUserVirtualCurrency(
            {
                "PlayFabId": currentPlayerId,
                "VirtualCurrency": "SP",
                "Amount": sp
            }
        );
    }
    else if (mobType == "EliteBoss")
    {
        cp = 1;
        //if elite boss
        server.AddUserVirtualCurrency(
            {
                "PlayFabId": currentPlayerId,
                "VirtualCurrency": "CP",
                "Amount": cp
            }
        );
    }
    
    var result = { "SL": sl, "SP": sp, "CP": cp };
    if (realItems.length > 0)
    {
        result.Items = realItems;
    }
    return result;
};
handlers.OpenTreasureBox = function (args) {
    //args.TownId should be int
    var townLevel = parseInt(args.TownLevel);
    var thisTownId = "Town_" + townLevel;
    var nextTownId = "Town_" + (townLevel < 29 ? townLevel + 1 : townLevel);
    log.info("thisTownId " + thisTownId);
    log.info("nextTownId " + nextTownId);
    var items = [];

    var nextTownItem = server.EvaluateRandomResultTable(
        {
            "CatalogVersion": catalogVersion,
            "PlayFabId": currentPlayerId,
            "TableId": nextTownId
        }
    );
    if (nextTownItem.ResultItemId != "Nothing") {
        log.info("item " + JSON.stringify(nextTownItem));
        items.push(nextTownItem.ResultItemId);
    }
    else {
        var thisTownItem = server.EvaluateRandomResultTable(
            {
                "CatalogVersion": catalogVersion,
                "PlayFabId": currentPlayerId,
                "TableId": thisTownId
            }
        );
        if (thisTownItem.ResultItemId != "Nothing") {
            log.info("item " + JSON.stringify(thisTownItem));
            items.push(thisTownItem.ResultItemId);
        }
    }

    var realItems = [];
    if (items.length > 0) {
        for (var i = 0; i < items.length; i++) {
            var itemGrantResult = server.GrantItemsToUser(
                {
                    "CatalogVersion": catalogVersion,
                    "PlayFabId": currentPlayerId,
                    "ItemIds": items
                }
            );
            realItems = realItems.concat(itemGrantResult["ItemGrantResults"]);
            log.info("realItems " + JSON.stringify(realItems));
        }
    }

    var result = { "Items": realItems };
    return result;
};
handlers.TakeScroll = function (args) {
    //args.TownId should be int
    var townLevel = parseInt(args.TownLevel);
    var dungeonLevel = parseInt(args.DungeonLevel) + 1;
    var sp = Math.floor(spDefault * Math.pow(1.2, (townLevel * 100 + dungeonLevel)));
    server.AddUserVirtualCurrency(
        {
            "PlayFabId": currentPlayerId,
            "VirtualCurrency": "SP",
            "Amount": sp
        }
    );
    var result = { "SP": sp };
    return result;
};
handlers.DecomposeItems = function (args) {
    var items = JSON.parse(args.Items);
    var totalPrice = 0;
    for (var i = 0; i < items.length; i++)
    {
        var itemInstance = items[i];
        var consumeItemResult = server.ConsumeItem({
            "PlayFabId": currentPlayerId,
            "ItemInstanceId": itemInstance.ItemInstanceId,
            "ConsumeCount": 1
        });
        totalPrice += itemInstance.UnitPrice;
    }
    var goldGainResult = server.AddUserVirtualCurrency(
        {
            "PlayFabId": currentPlayerId,
            "VirtualCurrency": "IP",
            "Amount": totalPrice
        }
    );
    return { "IP": totalPrice };
};
handlers.UpgradeItem = function (args) {
    
    var itemToUpgrade = JSON.parse(args.ItemInstance);
    var str = itemToUpgrade.ItemId;
    var rank = str.substring(str.lastIndexOf("_") + 1, str.lastIndexOf("_") + 2);
    rank = parseInt(rank);
    rank++;
    var RPToEnchant = Math.floor(enchantPriceInIP * Math.pow(1.4, rank));

    var newItemId = str.substr(0, str.lastIndexOf("_")) + "_" + rank + str.substr(str.lastIndexOf("_") + 2);

    var userInventory = server.GetUserInventory({
        "PlayFabId": currentPlayerId
    });

    //check if sufficient fund
    if (userInventory.VirtualCurrency == null
        || userInventory.VirtualCurrency.RP == null
        || parseInt(userInventory.VirtualCurrency.RP) < RPToEnchant) {
        log.info("Insufficient Fund");
        return { "Error": "Insufficient Fund" };
    }
    server.SubtractUserVirtualCurrency({
        "PlayFabId": currentPlayerId,
        "VirtualCurrency": "RP",
        "Amount": RPToEnchant
    });
    server.ConsumeItem({
        "PlayFabId": currentPlayerId,
        "ItemInstanceId": itemToUpgrade.ItemInstanceId,
        "ConsumeCount": 1
    });
    log.info("newItemId " + newItemId);
    var itemGrantResults = server.GrantItemsToUser({
        CatalogVersion: catalogVersion,
        PlayFabId: currentPlayerId,
        Annotation: "ItemUpgrade",
        ItemIds: [newItemId]
    });
    log.info("itemGrantResults " + JSON.stringify(itemGrantResults));
    return { "NewItem": JSON.stringify(itemGrantResults.ItemGrantResults[0]) };
};
handlers.EnchantItem = function (args) {
    var characterId = args.CharacterId;
    var itemToEnchant = JSON.parse(args.ItemInstance);
    var enchantLevel = 0;

    if (itemToEnchant.CustomData != null && itemToEnchant.CustomData.Enchant != null) {
        enchantLevel = parseInt(itemToEnchant.CustomData.Enchant);
    }
    //0~4, 5~9, 
    var IPToEnchant = Math.floor(enchantPriceInIP * Math.pow(1.4, enchantLevel));

    var userInventory = server.GetUserInventory({
        "PlayFabId": currentPlayerId
    });

    //check if sufficient fund
    if (userInventory.VirtualCurrency == null
        || userInventory.VirtualCurrency.IP == null
        || parseInt(userInventory.VirtualCurrency.IP) < IPToEnchant) {
        log.info("Insufficient Fund");
        return { "Error": "Insufficient Fund" };
    }
    server.SubtractUserVirtualCurrency({
        "PlayFabId": currentPlayerId,
        "VirtualCurrency": "IP",
        "Amount": IPToEnchant
    });
    enchantLevel++;
    var enchantSuccessResult = server.UpdateUserInventoryItemCustomData({
        PlayFabId: currentPlayerId,
        CharacterId: characterId,
        ItemInstanceId: itemToEnchant.ItemInstanceId,
        Data: { "Enchant": enchantLevel },
    });
    return {};
};
handlers.EquipItem = function (args) {
    var itemSwapInfos = JSON.parse(args.ItemSwapInfo);
    for (var i = 0; i < itemSwapInfos.length; i++) {
        var itemSwapInfo = itemSwapInfos[i];
        //unequip
        if (itemSwapInfo.PrevItemInstanceId != "") {
            itemSwapInfo.PlayFabId = currentPlayerId;
            itemSwapInfo.CharacterId = args.CharacterId;
            handlers.UnEquipItem(itemSwapInfo);
        }
        //equip
        server.MoveItemToCharacterFromUser({
            "PlayFabId": currentPlayerId,
            "CharacterId": args.CharacterId,
            "ItemInstanceId": itemSwapInfo.ItemToEquipInstanceId
        });
    }
};
handlers.UnEquipItem = function (args) {
    server.MoveItemToUserFromCharacter({
        "PlayFabId": currentPlayerId,
        "CharacterId": args.CharacterId,
        "ItemInstanceId": args.PrevItemInstanceId
    });
};
handlers.InAppPurchase = function (args) {
    if (args.ItemId == "lvluppackage") {
        var UpdateUserReadOnlyDataRequest = {
            "PlayFabId": currentPlayerId,
            "Data": {}
        };
        UpdateUserReadOnlyDataRequest.Data[LVL_UP_PAC] = JSON.stringify({ "TransactionId": args.TransactionId });
        server.UpdateUserReadOnlyData(UpdateUserReadOnlyDataRequest);
        var curHighestLevel = GetHigestLevel();
        checkLevelUpPackage(curHighestLevel);
    }
    else if (args.ItemId == "monthlypackage") {
        var monUpdateUserReadOnlyDataRequest = {
            "PlayFabId": currentPlayerId,
            "Data": {}
        };
        monUpdateUserReadOnlyDataRequest.Data[MON_SUB_PAC] = JSON.stringify({
            "TransactionId": args.TransactionId,
            "Date": 1,
            "NextTime": getKoreanTomorrow()
        });
        GrantItems(currentPlayerId, "GP100", "30일 패키지 보상입니다. ( " + 0 + "일)");
        server.UpdateUserReadOnlyData(monUpdateUserReadOnlyDataRequest);
    }
};
handlers.CheckMonthlySubscription = function (args) {
    var getUserReadOnlyDataResponse = server.GetUserReadOnlyData({
        "PlayFabId": currentPlayerId,
        "Keys": [MON_SUB_PAC]
    });
    var tracker = {};
    if (getUserReadOnlyDataResponse.Data.hasOwnProperty(MON_SUB_PAC)) {
        tracker = JSON.parse(getUserReadOnlyDataResponse.Data[MON_SUB_PAC].Value);
        var UpdateUserReadOnlyDataRequest = {
            "PlayFabId": currentPlayerId,
            "Data": {}
        };
        if (tracker.Date >= 30) {
            //delete
            UpdateUserReadOnlyDataRequest.KeysToRemove = [MON_SUB_PAC];
        }
        else//check time
        {
            var currentTime = new Date().getTime();
            //after one day
            if (tracker.NextTime < currentTime) {
                GrantItems(currentPlayerId, "GP300", "30일 패키지 보상입니다. (" + tracker.Date + " 일)");
                tracker.NextTime = getKoreanTomorrow();
                tracker.Date++;
                if (tracker.Date >= 30) {
                    UpdateUserReadOnlyDataRequest.KeysToRemove = [MON_SUB_PAC];
                }
                else {
                    UpdateUserReadOnlyDataRequest.Data[MON_SUB_PAC] = JSON.stringify(tracker);
                }
            }
        }
        server.UpdateUserReadOnlyData(UpdateUserReadOnlyDataRequest);
    }
};
function getKoreanTomorrow() {
    var currentDate = new Date();
    currentDate.setUTCDate(currentDate.getUTCDate() + 1);
    currentDate.setUTCHours(15, 0, 0, 0);
    return currentDate.getTime();
}
function checkLevelUpPackage(curHighestLevel) {
    var getUserReadOnlyDataResponse = server.GetUserReadOnlyData({
        "PlayFabId": currentPlayerId,
        "Keys": [LVL_UP_PAC]
    });
    var tracker = {};
    if (!getUserReadOnlyDataResponse.Data.hasOwnProperty(LVL_UP_PAC)) {
        return;
    }
    else {
        tracker = JSON.parse(getUserReadOnlyDataResponse.Data[LVL_UP_PAC].Value);

        var lvlFrom = 1;
        if (tracker.Level != null) {
            lvlFrom = tracker.Level;
        }
        for (var i = lvlFrom; i < curHighestLevel; i++) {
            GrantItems(currentPlayerId, "GP200", "Lv." + i + " 레벨업 패키지 보상입니다.");
        }

        tracker.Level = curHighestLevel;
        var UpdateUserReadOnlyDataRequest = {
            "PlayFabId": currentPlayerId,
            "Data": {}
        };
        UpdateUserReadOnlyDataRequest.Data[LVL_UP_PAC] = JSON.stringify(tracker);
        server.UpdateUserReadOnlyData(UpdateUserReadOnlyDataRequest);
    }
}
function GrantItems(userId, items, annotation) {
    log.info("Granting: " + items);
    var parsed = Array.isArray(items) ? items : [items];

    var GrantItemsToUserRequest = {
        "CatalogVersion": catalogVersion,
        "PlayFabId": userId,
        "ItemIds": parsed,
        "Annotation": annotation
    };

    var grantItemsToUserResult = server.GrantItemsToUser(GrantItemsToUserRequest);

    log.info("Item Granted: " + JSON.stringify(grantItemsToUserResult));
    for (var i = 0; i < grantItemsToUserResult.ItemGrantResults.length; i++)
    {
        log.info("Item ID: " + grantItemsToUserResult.ItemGrantResults[i].ItemInstanceId);
        var updateReasonResult = server.UpdateUserInventoryItemCustomData({
            PlayFabId: userId,
            ItemInstanceId: grantItemsToUserResult.ItemGrantResults[i].ItemInstanceId,
            Data: { "Reason": annotation },
        });
    }

    return JSON.stringify(grantItemsToUserResult.ItemGrantResults);
}
handlers.GetServerTime = function (args)
{
    return { "Time" : new Date().getTime()};
};
handlers.RewardQuest = function (args) {
    var userData = server.GetUserData(
         {
             "PlayFabId": currentPlayerId,
             "Keys": [
                 "DailyQuest"
             ]
         }
     );
    var dailyQuestSet = JSON.parse(userData.Data.DailyQuest.Value.replace(/\\/g, ""));
    var quest = null;
    for (var i = 0; i < dailyQuestSet.Quests.length; i++) {
        if (dailyQuestSet.Quests[i].QuestType == args.QuestType) {
            quest = dailyQuestSet.Quests[i];
            break;
        }
    }
    quest.HasReceivedReward = true;
    server.AddUserVirtualCurrency(
        {
            "PlayFabId": currentPlayerId,
            "VirtualCurrency": quest.QuestReward.QuestRewardType,
            "Amount": parseInt(quest.QuestReward.Count)
        }
    );
    var commitData = {};
    commitData["DailyQuest"] = JSON.stringify(dailyQuestSet);
    server.UpdateUserData(
		{
		    "PlayFabId": currentPlayerId,
		    "Data": commitData
		}
	);
    return {};
};
handlers.SummonItem = function (args) {
    log.info("PlayFabId " + args.PlayFabId);

    var count = args.Count;
    var gemPrice = count == 11 ? 3000 : 300;
    var dropTableId = "Gotcha" + args.DropTableId;

    log.info("gemPrice " + gemPrice);

    var userInv = server.GetUserInventory({
        "PlayFabId": currentPlayerId
    });
    var currentGem = userInv.VirtualCurrency.GP;
    if (currentGem < gemPrice) {
        return { "Error": "Insufficient Gem" };
    }
    if (gemPrice > 0) {
        server.SubtractUserVirtualCurrency(
            {
                "PlayFabId": currentPlayerId,
                "VirtualCurrency": "GP",
                "Amount": gemPrice
            }
        );
    }
    var items = [];
    for (var i = 0; i < count; i++) {
        var randomItem = server.EvaluateRandomResultTable(
            {
                "CatalogVersion": catalogVersion,
                "PlayFabId": currentPlayerId,
                "TableId": dropTableId
            }
        );
        if (randomItem.ResultItemId != "Nothing") {
            log.info("item " + JSON.stringify(randomItem));
            items.push(randomItem.ResultItemId);
        }
    }
    if (count == 11) {
        var hasAnyAboveFour = false;
        for (var i = 0; i < items.length; i++) {
            var _str = items[i];
            var str = _str.substr(_str.length - 2, 1);
            if (parseInt(str) >= 4) {
                hasAnyAboveFour = true;
                break;
            }
        }
        if (!hasAnyAboveFour) {
            var randomItem = server.EvaluateRandomResultTable(
                {
                    "CatalogVersion": catalogVersion,
                    "PlayFabId": currentPlayerId,
                    "TableId": (dropTableId + "Bonus")
                }
            );
            items.pop();
            items.push(randomItem.ResultItemId);
        }
    }
    var realItems = [];
    var itemGrantResult = server.GrantItemsToUser(
        {
            "CatalogVersion": catalogVersion,
            "PlayFabId": currentPlayerId,
            "ItemIds": items
        }
    );
    realItems = realItems.concat(itemGrantResult["ItemGrantResults"]);
    var result = {};
    result.Items = realItems;
    return result;
};
handlers.MassiveSoul = function (args) {
    var gemPrice = parseInt(args.Gem);
    var multiplier = 10;
    if (gemPrice == 0)
    {
        multiplier = 10;
    }
    else if (gemPrice == 50) {
        multiplier = 100;
    }
    else
    {
        multiplier = 0;
    }
    var dungeonLevel = parseInt(args.DungeonLevel) + 1;
    var sl = Math.floor(slDefault * Math.pow(1.2, dungeonLevel)) * multiplier;
    if (gemPrice > 0)
    {
        server.SubtractUserVirtualCurrency(
            {
                "PlayFabId": currentPlayerId,
                "VirtualCurrency": "GP",
                "Amount": gemPrice
            }
        );
    }
    
    server.AddUserVirtualCurrency(
        {
            "PlayFabId": currentPlayerId,
            "VirtualCurrency": "SL",
            "Amount": sl
        }
    );
};
handlers.ReturnToFirstTown = function (args)
{
    var gem = parseInt(args.Gem);
    var dungeonLevel = parseInt(args.DungeonLevel);
    var townLevel = parseInt(args.TownLevel);
    var x = (townLevel * 100 + dungeonLevel);
    var lp = lpDefault + 10000 * x / (x + 20000);

    var userInventory = server.GetUserInventory({
        "PlayFabId": currentPlayerId
    });
    var sl = userInventory.VirtualCurrency.SL;
    if (sl > 0)
    {
        server.SubtractUserVirtualCurrency(
            {
                "PlayFabId": currentPlayerId,
                "VirtualCurrency": "SL",
                "Amount": sl
            }
        );
    }
    
    if (gem == 0)
    {
    }
    else
    {
        server.SubtractUserVirtualCurrency(
            {
                "PlayFabId": currentPlayerId,
                "VirtualCurrency": "GP",
                "Amount": gem
            }
        );
        lp = lp * 2;
    }
    lp = Math.ceil(lp);
    server.AddUserVirtualCurrency(
        {
            "PlayFabId": currentPlayerId,
            "VirtualCurrency": "LP",
            "Amount": lp
        }
    );
    
    server.UpdateUserData(
		{
		    "PlayFabId": currentPlayerId,
		    "Data": {"DungeonLevel":0,"TownLevel":0}
		}
	);
    var allCharacters = server.GetAllUsersCharacters({
        "PlayFabId": currentPlayerId
    });
    for (var i = 0; i < allCharacters.Characters.length; i++) {
        var characterId = allCharacters.Characters[i].CharacterId;
        server.UpdateCharacterData({
            "PlayFabId": currentPlayerId,
            "CharacterId": characterId,
            "Data": { "SoulAttackLevel": 0, "SoulHitPointLevel": 0 }
        });
    }
    return { "SL": sl, "LP" : lp };
};