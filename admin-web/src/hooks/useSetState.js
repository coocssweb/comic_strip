import { useCallback, useState } from 'react';

const useSetState = (initialState = {}) => {
    const [state, set] = useState(initialState);
    const setState = useCallback((patch) => {
        set((previousState) => Object.assign({}, previousState, patch instanceof Function ? patch(previousState) : patch));
    }, []);

    return [state, setState];
};

export default useSetState;
