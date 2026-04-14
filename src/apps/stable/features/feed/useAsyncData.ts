import { useEffect, useState, type DependencyList } from 'react';

type UseAsyncDataOptions = {
    enabled?: boolean;
    resetOnDisable?: boolean;
    disableError?: string | null;
    errorMessage?: string;
};

export function useAsyncData<T>(
    loadData: () => Promise<T>,
    deps: DependencyList,
    options: UseAsyncDataOptions = {}
) {
    const {
        enabled = true,
        resetOnDisable = true,
        disableError = null,
        errorMessage = 'Failed to load data'
    } = options;
    const [data, setData] = useState<T | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;

        if (!enabled) {
            if (resetOnDisable) {
                setData(null);
            }
            setError(disableError);
            return () => {
                cancelled = true;
            };
        }

        loadData()
            .then((result) => {
                if (!cancelled) {
                    setData(result);
                    setError(null);
                }
            })
            .catch((fetchError) => {
                if (!cancelled) {
                    setError(fetchError instanceof Error ? fetchError.message : errorMessage);
                }
            });

        return () => {
            cancelled = true;
        };
    // `loadData` intentionally omitted. Caller controls lifecycle with `deps`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, deps);

    return {
        data,
        error,
        setData,
        setError
    };
}
