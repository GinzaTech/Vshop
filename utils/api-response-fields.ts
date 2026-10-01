/** Known diagnostic field names, not a heuristic that arbitrary text is safe.
 * Unknown fields retain an omission marker instead of their key/value. Extend
 * this set deliberately from an upstream contract; never learn keys from data.
 */
const fields = new Set(`
  data items count total totalcount totalresults startindex endindex offset limit
  success status statuscode error errorcode message response result results
  nested self record name value stored headers headerslist type category code
  token accesstoken idtoken entitlementstoken refreshtoken expiresin nonce state
  password passwd authorization cookie secret credential apikey otp pin ssid tdid clid
  capability connectiondetails gameclienthash playerkey privatekey signingkey
  invitecode roomcode joincode accesskey subject puuid userid accountid sessionid
  playerid matchid partyid sub email gamename tagline username phone session
  displayname displaynamefallback categorytext description uuid id version
  players player members member accounts account teams team stats rounds roundresults
  balances cost discountcosts totalbasecost totaldiscountedcost currencylimits currencies
  catalog assets offers rewards entitlements entitlementsbytypes inventory
  item itemid itemids itemtypeid itemtypeids amount quantity owned isowned
  level levels chromas skins weapons agents maps modes seasons acts bundles
  featuredBundle featuredBundles bundle remainingdurationinseconds bundlepurchaseinfo
  itemoffers offer offersremainingdurationinseconds discountpercent discountedprice baseprice
  accessoryStore accessoryoffers skinstorefrontlayout bonusstore bonusstoreoffers
  singleitemoffers singleitemstoreoffers singleitemoffersremainingdurationinseconds
  characterid characterselectionstate characterselectiontime characterselectiontimeleft
  previousstate pregamestate accessibility privacy gamepodid requestedgamepodid
  matchmakingdata customgamedata eligiblequeues queueineligibilities queueid
  isready isowner isleader isally playercardid playertitleid preferredlevelborderid
  competitiveTier competitiveTierProgress rankedrating leaderboardrank numberofgames
  queueskills seasonalinfoBySeasonid wins losses draws gamesplayed seasonid actid
  currenttier highestrank highesttier rr history matches matchinfo playerstats
  kills deaths assists score roundscore teamid teamwon roundswon roundsplayed
  accountlevel xp progress xpbycategory levelborderid competitiveupdates rating
  identity guns sprays activeexpressions expressions dynamicoptions equipslotid slotindex
  enabled enabledstatus restrictions invites requests min max duration timestamp
  starttime endtime creationdate expirationdate expiry expires lastupdated updatedat
  remainingseconds remainingsecs elapsedtime servermillis ping pings latency
`.toLowerCase().split(/\s+/).filter(Boolean));

const enumValues = new Set(`
  BAD_REQUEST UNAUTHORIZED FORBIDDEN NOT_FOUND INVALID_REQUEST RESOURCE_NOT_FOUND
  SUCCESS ERROR OK ERR_NETWORK ECONNABORTED ETIMEDOUT ERR_CANCELED ERR_BAD_REQUEST ERR_BAD_RESPONSE
  Equippable Skin SkinLevel SkinChroma Charm Buddy PlayerCard PlayerTitle Spray Flex Agent
  Select Deluxe Premium Exclusive Ultra Legendary Common Rare Epic
  Rifle SMG Sidearm Shotgun Sniper Heavy Melee Blue Red Neutral Spectator
  unrated competitive spikerush swiftplay deathmatch ggteam hurm custom newmap
  PC Windows Console Xbox PS5
`.toLowerCase().split(/\s+/).filter(Boolean));

export function isKnownApiResponseField(key: string): boolean {
  return fields.has(key.toLowerCase());
}

export function isKnownApiResponseEnum(key: string, value: string): boolean {
  if (/^(?:locale|language)$/i.test(key)) {
    return /^(?:en(?:-US)?|vi(?:-VN)?|ja(?:-JP)?|ko(?:-KR)?|zh-(?:CN|TW)|de(?:-DE)?|fr(?:-FR)?|es-(?:ES|MX)|pt-BR|ru(?:-RU)?|tr(?:-TR)?|th(?:-TH)?|id(?:-ID)?|pl(?:-PL)?|it(?:-IT)?)$/i.test(value.replace(/_/g, "-"));
  }
  if (/^(?:version|clientversion)$/i.test(key)) {
    return /^\d{1,8}(?:\.\d{1,8}){0,3}$/.test(value) || /^release-\d{1,3}\.\d{1,3}-shipping-\d{1,4}-\d{4,10}$/.test(value);
  }
  return enumValues.has(value.toLowerCase());
}
