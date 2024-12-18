import qs from "query-string";

interface UrlQueryParams {
  params: string;
  key: string;
  value: string;
}
interface RemoveUrlQueryParams {
  params: string;
  keysToRemove: string[];
}
export const formUrlQuery = ({ params, key, value }: UrlQueryParams) => {
  // {query: "search query"}
  const queryString = qs.parse(params);
  queryString[key] = value;

  return qs.stringifyUrl({
    url: window.location.pathname,
    query: queryString,
  });
};

export const removeKeysFromUrlQuery = ({
  params,
  keysToRemove,
}: RemoveUrlQueryParams) => {
  const queryString = qs.parse(params);

  keysToRemove.forEach((key) => {
    delete queryString[key];
  });
  // NOTE: FROM QUERY-STRING PACKAGE
  // queryString.stringifyUrl({ url: "https://foo.bar", query: { foo: "bar" } });
  // //=> 'https://foo.bar?foo=bar'

  // console.log(location.search);
  // //=> '?foo=bar'

  // const parsed = queryString.parse(location.search);
  // console.log(parsed);
  // //=> {foo: 'bar'}

  return qs.stringifyUrl(
    {
      url: window.location.pathname,
      query: queryString,
    },
    { skipNull: true }
  );
};
