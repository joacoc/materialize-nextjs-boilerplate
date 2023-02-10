import { FieldDef } from "pg";
import React, { useState, useRef, useEffect } from "react";
import { Params, Results, State } from ".";

const defaultError = "Error running query.";

/**
 * A React hook that runs a SQL query against the current environment.
 * @params {string} sql to execute in the environment coord or current global coord.
 * @params {object} extraParams in case a particular environment needs to be used rather than the global environment (global coord)
 */
export default function useQuery(params: Params): State {
    const [loading, setLoading] = useState<boolean>(true);
    const requestIdRef = useRef(1);
    const controllerRef = useRef<AbortController>();
    const [results, setResults] = useState<Results | null>(null);
    const [error, setError] = useState<string | null>(null);

    const runSql = React.useCallback(async () => {
      if (!params.query.sql) {
        setResults(null);
        return;
      }

      const requestId = requestIdRef.current;
      try {
        setLoading(true);
        const { results: res, errorMessage } = await executeSql(params);
        if (requestIdRef.current > requestId) {
          // a new query has been kicked off, ignore these results
          return;
        }
        if (errorMessage) {
          setResults(null);
          setError(errorMessage);
        } else {
          setResults(res);
          setError(null);
        }
      } catch (err) {
        console.error(err);
        setError(defaultError);
      } finally {
        setLoading(false);
      }
    }, [params]);

    useEffect(() => {
      requestIdRef.current += 1;
      controllerRef.current && controllerRef.current.abort();
      runSql();
    }, [runSql]);

    return { data: results, error, loading, reload: runSql };
  }

  interface ExecuteSqlOutput {
    results: Results | null;
    errorMessage: string | null;
  }

  export const executeSql = async (
    params: Params,
    requestOpts?: RequestInit
  ): Promise<ExecuteSqlOutput> => {
    const { query, config } = params;
    const result: ExecuteSqlOutput = {
      results: null,
      errorMessage: null,
    };
    if (!config.host || !query.sql) {
      return result;
    }

    const response = await fetch(
      `/api/query`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          params
        }),
        ...requestOpts,
      }
    );

    const responseText = await response.text();

    if (!response.ok) {
      result.errorMessage = `HTTP Error ${response.status}: ${
        responseText ?? defaultError
      }`;
    } else {
      const parsedResponse = JSON.parse(responseText);

      // Queries like `CREATE TABLE` or `CREATE CLUSTER` returns a null inside the results array
      const { error: resultsError, rows, fields } = parsedResponse || {};
      let getColumnByName = undefined;
      const columnMap = new Map();

      if (fields) {
        (fields as Array<FieldDef>).forEach(({ name }, index) => columnMap.set(name, index));
        getColumnByName = (row: any[], name: string) => {
          const index = columnMap.get(name);
          if (index === undefined) {
            throw new Error(`Column named ${name} not found`);
          }

          return row[index];
        };
      }

      if (resultsError) {
        result.errorMessage = resultsError;
      } else {
        result.results = {
          rows: rows,
          columns: Array.from(columnMap.keys()),
          getColumnByName,
        };
        result.errorMessage = null;
      }
    }
    return result;
  };