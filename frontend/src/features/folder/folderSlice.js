import { createSlice, nanoid } from "@reduxjs/toolkit";

const initialState = {
    folders: [
        { id: "1", name: "개인별로" },
        { id: "2", name: "정기 미팅" },
    ],
};

const folderSlice = createSlice({
    name: "folder",
    initialState,
    reducers: {
        addFolder: {
            reducer(state, action) {
                state.folders.push(action.payload);
            },
            prepare(name) {
                return { payload: { id: nanoid(), name } };
            },
        },
        renameFolder(state, action) {
            const { id, name } = action.payload;
            const folder = state.folders.find((f) => f.id === id);
            if (folder) folder.name = name;
        },
        deleteFolder(state, action) {
            const folderId = action.payload;
            const target = state.folders.find((f) => f.id === folderId);
            if (!target) return;
            state.folders = state.folders.filter((f) => f.id !== folderId);
            // ✅ payload 대신 폴더 이름을 별도 action으로 전달하도록 바꿈
            action.meta = { deletedName: target.name };
        },
    },
});

export const { addFolder, renameFolder, deleteFolder } = folderSlice.actions;
export default folderSlice.reducer;
