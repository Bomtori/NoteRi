// src/features/record/recordSlice.js
import { createSlice, nanoid } from "@reduxjs/toolkit";
import { deleteFolder } from "../folder/folderSlice";
import { mockRecords } from "../../mock/records"; // ✅ 실제 목데이터 import

const initialState = {
    records: mockRecords, // ✅ mock 데이터를 초기값으로 세팅
};

const recordSlice = createSlice({
    name: "record",
    initialState,
    reducers: {
        addRecord: {
            reducer(state, action) {
                state.records.push(action.payload);
            },
            prepare(record) {
                return {
                    payload: {
                        id: nanoid(),
                        ...record,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                    },
                };
            },
        },
        deleteRecord(state, action) {
            state.records = state.records.filter((r) => r.id !== action.payload);
        },
        renameRecord(state, action) {
            const { id, title } = action.payload;
            const record = state.records.find((r) => r.id === id);
            if (record) record.title = title;
        },
        changeRecordFolder(state, action) {
            const { id, folder_id } = action.payload;
            const record = state.records.find((r) => r.id === id);
            if (record) record.folder_id = folder_id;
        },
        // src/features/record/recordSlice.js
        updateMemo(state, action) {
            const { id, memo } = action.payload;
            const record = state.records.find((r) => r.id === id);
            if (record) record.memo = memo;
        },
        updateFolder: (state, action) => {
            const { id, folderId } = action.payload;
            const record = state.records.find((r) => r.id === id);
            if (record) {
                record.folderId = folderId;
                const folder = state.folders.find((f) => f.id === folderId);
                record.folderName = folder ? folder.name : "폴더 없음";
            }
        },
        setRecords(state, action) {
            state.records = action.payload;
        },

    },
    extraReducers: (builder) => {
        builder.addCase(deleteFolder, (state, action) => {
            const deletedFolderId = action.payload; // 삭제된 폴더 ID 기준
            state.records = state.records.filter(
                (r) => r.folder_id !== deletedFolderId
            );
        });
    },

});

export const { addRecord,
    deleteRecord, renameRecord,
    changeRecordFolder,
    updateMemo,
    updateFolder,
    setRecords,
} = recordSlice.actions;
export default recordSlice.reducer;
