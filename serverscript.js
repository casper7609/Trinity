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
    var itemGrantResult = server.GrantItemsToCharacter({
        "Annotation": "Char Creation Basic Item",
        "CatalogVersion": catalogVersion,
        "PlayFabId": currentPlayerId,
        "CharacterId": characterId,
        "ItemIds": [itemId]
    });
    log.info("grantItemResult " + JSON.stringify(itemGrantResult));
    var grantedItems = itemGrantResult["ItemGrantResults"];
    for (var i = 0; i < grantedItems.length; i++) {
        updateItemData(grantedItems[i], characterId);
    }
    return { "CharacterId": characterId };
};
handlers.KilledMob = function (args)
{
    var mobType = args.MobType;
    var townLevel = parseInt(args.TownLevel);
    var soulGainAmplifier = parseFloat(args.SoulGainAmplifier) + 1;
    var dungeonLevel = parseInt(args.DungeonLevel) + 1;
    var x = (townLevel * 100 + dungeonLevel);
    var townId = "Town_" + parseInt(parseInt(townLevel) / 6);
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
            var grantedItems = itemGrantResult["ItemGrantResults"];
            for (var i = 0; i < grantedItems.length; i++) {
                realItems.push(updateItemData(grantedItems[i]));
            }
        }
    }
    //if normal
    if (mobType == "Normal")
    {
        sl = Math.floor((slDefault + 10000 * x / (x + 20000)) * soulGainAmplifier);
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
        sp = Math.floor(slDefault + 10000 * x / (x + 20000));
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
        cp = Math.floor(slDefault + 10000 * x / (x + 20000));
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
function updateItemData(item, characterId, mainFeature)
{
    log.info("updateItemData " + JSON.stringify(item));

    var str = item.ItemId;
    var rank = str.substring(str.lastIndexOf("_") + 1, str.lastIndexOf("_") + 2);
    rank = parseInt(rank);
    var chance = Math.min((rank + 1), 4);
    //var newItemId = str.substr(0, str.lastIndexOf("_")) + "_" + rank + str.substr(str.lastIndexOf("_") + 2);
    var weaponMainOptions = ["AttackPower", "CoolTimeReduction", "AttackSpeed", "CriticalChance", "CriticalDamage", "SoulGain"];
    var armorMainOptions = ["MoveSpeed", "ArmorClass", "MagicResistance", "HitPoint", "SoulGain"];
    var accessoryMainOptions = ["AttackPower", "ArmorClass", "MagicResistance", "CriticalChance", "CriticalDamage", "SoulGain"];
    var commonOptions = ["AttackPower", "CoolTimeReduction", "AttackSpeed", "MoveSpeed", "ArmorClass", "MagicResistance", "HitPoint", "CriticalChance", "CriticalDamage", "SoulGain"];
    var fArray = [];
    var customData = { "Enchant": "0" };
    fArray.push({ "Key": "Enchant", "Value": "0" });
    for (var i = 0; i < chance; i++)
    {
        if (item.ItemClass == "Weapon")
        {
            var picked = weaponMainOptions[Math.floor(Math.random() * weaponMainOptions.length)];
            if (i == 0)
            {
                if (mainFeature != null)
                {
                    picked = mainFeature;
                }
                customData["Main"] = picked;
                fArray.push({ "Key": "Main", "Value": picked });
                customData[picked] = rand(100, (rank + 1) * 100).toString();
                fArray.push({ "Key": picked, "Value": customData[picked] });
            }
            else
            {
                customData[picked] = rand(100, (rank) * 100).toString();
                fArray.push({ "Key": picked, "Value": customData[picked] });
            }
            weaponMainOptions.splice(weaponMainOptions.indexOf(picked), 1);
        }
        else if (item.ItemClass == "Armor") {
            var picked = armorMainOptions[Math.floor(Math.random() * armorMainOptions.length)];
            if (i == 0) {
                if (mainFeature != null) {
                    picked = mainFeature;
                }
                customData["Main"] = picked;
                fArray.push({ "Key": "Main", "Value": picked });
                customData[picked] = rand(100, (rank + 1) * 100).toString();
                fArray.push({ "Key": picked, "Value": customData[picked] });
            }
            else {
                customData[picked] = rand(100, (rank) * 100).toString();
                fArray.push({ "Key": picked, "Value": customData[picked] });
            }

            armorMainOptions.splice(armorMainOptions.indexOf(picked), 1);
        }
        else
        {
            var picked = "";
            if (i == 0) {
                if (mainFeature != null) {
                    picked = mainFeature;
                }
                picked = accessoryMainOptions[Math.floor(Math.random() * accessoryMainOptions.length)];
                customData["Main"] = picked;
                fArray.push({ "Key": "Main", "Value": picked });
                customData[picked] = rand(100, (rank + 1) * 100).toString();
                fArray.push({ "Key": picked, "Value": customData[picked] });
            }
            else {
                picked = commonOptions[Math.floor(Math.random() * commonOptions.length)];
                customData[picked] = rand(100, (rank) * 100).toString();
                fArray.push({ "Key": picked, "Value": customData[picked] });
            }

            accessoryMainOptions.splice(accessoryMainOptions.indexOf(picked), 1);
            commonOptions.splice(commonOptions.indexOf(picked), 1);
        }
    }
    var cData = {};
    for (var i = 0; i < fArray.length; i++)
    {
        cData[fArray[i].Key] = fArray[i].Value;
        if (i > 0 && i % 4 == 0)
        {
            var updateData = {
                PlayFabId: currentPlayerId,
                ItemInstanceId: item.ItemInstanceId,
                Data: cData,
            };
            if (characterId != null) {
                updateData["CharacterId"] = characterId;
            }
            var result = server.UpdateUserInventoryItemCustomData(updateData);
            cData = {};
        }
    }
    if (Object.keys(cData).length > 0 && Object.keys(cData).length < 5)
    {
        var updateData = {
            PlayFabId: currentPlayerId,
            ItemInstanceId: item.ItemInstanceId,
            Data: cData,
        };
        if (characterId != null) {
            updateData["CharacterId"] = characterId;
        }
        var result = server.UpdateUserInventoryItemCustomData(updateData);
        log.info("commit " + JSON.stringify(cData));
    }

    item["CustomData"] = customData;
    return item;
}
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
            var grantedItems = itemGrantResult["ItemGrantResults"];
            for (var i = 0; i < grantedItems.length; i++) {
                realItems.push(updateItemData(grantedItems[i]));
            }
        }
    }

    var result = { "Items": realItems };
    return result;
};
handlers.TakeScroll = function (args) {
    //args.TownId should be int
    var townLevel = parseInt(args.TownLevel);
    var dungeonLevel = parseInt(args.DungeonLevel) + 1;
    var x = (townLevel * 100 + dungeonLevel);
    var sp = Math.floor(slDefault + 10000 * x / (x + 20000));
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
handlers.TakeEmblem = function (args) {
    //args.TownId should be int
    var townLevel = parseInt(args.TownLevel);
    var dungeonLevel = parseInt(args.DungeonLevel) + 1;
    var x = (townLevel * 100 + dungeonLevel);
    var type = rand(0, 100);
    var typeStr = "";
    var amount = 1;
    if (type < 20)
    {
        typeStr = "SL";
        amount *= x;
    }
    else if (type <= 20 && type < 40)
    {
        typeStr = "LP";
    }
    else if (type <= 40 && type < 60) {
        typeStr = "CP";
    }
    else if (type <= 60 && type < 80) {
        typeStr = "SP";
    }
    else if (type <= 80 && type < 90) {
        typeStr = "RP";
    }
    else if (type <= 90 && type < 100) {
        typeStr = "GP";
    }
    server.AddUserVirtualCurrency(
        {
            "PlayFabId": currentPlayerId,
            "VirtualCurrency": typeStr,
            "Amount": amount
        }
    );
    var result = {};
    result[typeStr] = amount;
    return result;
};
handlers.DecomposeItems = function (args) {
    var items = JSON.parse(args.Items);
    var totalPrice = 0;
    for (var i = 0; i < items.length; i++)
    {
        var itemInstance = items[i];
        server.RevokeInventoryItem({
            "PlayFabId": currentPlayerId,
            "ItemInstanceId": itemInstance.ItemInstanceId,
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
    var mainFeature = itemToUpgrade.CustomData.Main;
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
    var characterId = args.CharacterId;
    var itemGrantResult = null;
    log.info("newItemId " + newItemId);
    var newItem = null;
    if (characterId == null || characterId == "") {
        server.RevokeInventoryItem({
            "PlayFabId": currentPlayerId,
            "ItemInstanceId": itemToUpgrade.ItemInstanceId,
        });
        itemGrantResult = server.GrantItemsToUser({
            CatalogVersion: catalogVersion,
            PlayFabId: currentPlayerId,
            Annotation: "ItemUpgrade",
            ItemIds: [newItemId]
        });
        var grantedItems = itemGrantResult["ItemGrantResults"];
        for (var i = 0; i < grantedItems.length; i++) {
            newItem = updateItemData(grantedItems[i], null, mainFeature);
        }
    }
    else
    {
        server.RevokeInventoryItem({
            "PlayFabId": currentPlayerId,
            "CharacterId": characterId,
            "ItemInstanceId": itemToUpgrade.ItemInstanceId,
        });
        itemGrantResult = server.GrantItemsToCharacter({
            CatalogVersion: catalogVersion,
            CharacterId: characterId,
            PlayFabId: currentPlayerId,
            Annotation: "ItemUpgrade",
            ItemIds: [newItemId]
        });
        var grantedItems = itemGrantResult["ItemGrantResults"];
        for (var i = 0; i < grantedItems.length; i++) {
            newItem = updateItemData(grantedItems[i], characterId, mainFeature);
        }
    }
    log.info("itemGrantResults " + JSON.stringify(newItem));
   
    return { "NewItem": JSON.stringify(newItem) };
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
        GrantItems(currentPlayerId, "GP300", "30일 패키지 보상입니다. ( " + 1 + "일)");
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
                GrantItems(currentPlayerId, "GP100", "30일 패키지 보상입니다. (" + (parseInt(tracker.Date) + 1) + " 일)");
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
    var grantedItems = itemGrantResult["ItemGrantResults"];
    var result = {};
    result.Items = grantedItems;
    return result;
};
handlers.UpdateSummonItemData = function (args) {
    log.info("PlayFabId " + args.PlayFabId);
    var items = args.Items;
    var realItems = [];
    for (var i = 0; i < items.length; i++) {
        realItems.push(updateItemData(items[i]));
    }
    var result = {};
    result.Items = realItems;
    return result;
};
handlers.MassiveSoul = function (args) {
    var gemPrice = parseInt(args.Gem);
    var multiplier = 10;
    if (gemPrice == 0)
    {
        multiplier = 100;
    }
    else if (gemPrice == 50) {
        multiplier = 1000;
    }
    else
    {
        multiplier = 0;
    }
    var townLevel = parseInt(args.TownLevel);
    var dungeonLevel = parseInt(args.DungeonLevel) + 1;
    var x = (townLevel * 100 + dungeonLevel);
    var sl = Math.floor(slDefault + 10000 * x / (x + 20000)) * multiplier;
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
handlers.MapQuestReward = function (args) {
    var userData = server.GetUserData(
        {
            "PlayFabId": currentPlayerId,
            "Keys": [
                "MapQuest"
            ]
        }
    );
    var mapQuests = JSON.parse(userData.Data.MapQuest.Value.replace(/\\/g, ""));
    var quest = mapQuests[parseInt(args.QuestIndex)];
    quest.Hrr = true;
    server.AddUserVirtualCurrency(
        {
            "PlayFabId": currentPlayerId,
            "VirtualCurrency": quest.Qrt,
            "Amount": parseInt(quest.Cnt)
        }
    );
    var commitData = {};
    commitData["MapQuest"] = JSON.stringify(mapQuests);
    server.UpdateUserData(
		{
		    "PlayFabId": currentPlayerId,
		    "Data": commitData
		}
	);
    return {};
};