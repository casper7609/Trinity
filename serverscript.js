var catalogVersion = "0.9";
handlers.PurchaseCharacter = function (args) {
    log.info("PlayFabId " + currentPlayerId);
    log.info("ClassType " + args.ClassType);
    log.info("ClassStatus " + args.ClassStatus);
    var classType = args.ClassType;

    var gemPrice = 0;
    var allChars = server.GetAllUsersCharacters({
        "PlayFabId": currentPlayerId
    });
    if (allChars.Characters.length < 4) {
        gemPrice = 0;
    }
    else {
        gemPrice = 400 * Math.pow(2, (allChars.Characters.length - 4));
    }
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
    delete classStatus["Luck"];
    server.UpdateCharacterData({
        "PlayFabId": currentPlayerId,
        "CharacterId": characterId,
        "Data": classStatus
    });
    var isActive = allChars.Characters.length == 0;
    var isLeader = allChars.Characters.length == 0;
    server.UpdateCharacterData({
        "PlayFabId": currentPlayerId,
        "CharacterId": characterId,
        "Data": { "Luck": luck, "IsActive": isActive, "IsLeader": isLeader, "Level": 0, "SoulLevel": 0}
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
    return characterId;
};
handlers.KilledMob = function (args)
{
    var mobType = args.MobType;
    var dungeonLevel = args.DungeonLevel;
    var townId = "Town_" + Math.floor((parseInt(dungeonLevel) / 500));
    var items = [];

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
        //add random stat here
    }
    var result = { "ItemCount": items.length };
    return result;
};
handlers.DecomposeItems = function (args) {
    var items = JSON.parse(args.Items);
    var totalPrice = 0;
    for (var i = 0; i < item.length; i++)
    {
        var itemInstance = item[i];
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