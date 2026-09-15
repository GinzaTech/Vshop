import { useAccountScreenData, type AccountScreenSession } from "~/hooks/useAccountScreenData";
import { getPublicContracts, type PublicContractDefinition } from "~/services/valorant/public-api";
import { getVAPILang } from "~/utils/localization";
import { getContracts } from "~/utils/valorant-api";

type ContractsData = {
  contracts: ContractsResponse | null;
  contractDefinitions: PublicContractDefinition[];
};

const EMPTY_DATA: ContractsData = { contracts: null, contractDefinitions: [] };

async function loadContractsData(session: AccountScreenSession) {
  const { accessToken, entitlementsToken, region, id } = session;
  const results = await Promise.allSettled([
    getContracts(accessToken, entitlementsToken, region, id),
    getPublicContracts(getVAPILang()),
  ]);
  const [contracts, definitions] = results;
  return {
    data: {
      ...(contracts.status === "fulfilled" && contracts.value ? { contracts: contracts.value } : {}),
      ...(definitions.status === "fulfilled" && definitions.value ? { contractDefinitions: definitions.value } : {}),
    },
    errors: results.filter((result) => result.status === "rejected").map((result) => result.reason as unknown),
  };
}

export function useContractsScreenData() {
  const { data, loading, reload, session } = useAccountScreenData(loadContractsData, EMPTY_DATA, "[contracts] fetch error:");
  return { ...data, loading, reload, session };
}
