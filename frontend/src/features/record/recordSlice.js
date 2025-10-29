// src/features/record/recordSlice.js
import { createSlice } from "@reduxjs/toolkit";

const initialState = {
    records: [],
};

const recordSlice = createSlice({
    name: "record",
    initialState,
    reducers: {
        // 전체 세팅
        setRecords: (state, action) => {
            state.records = action.payload;
        },

        // 하나 업데이트 (이름 변경 등)
        updateRecord: (state, action) => {
            const updated = action.payload;
            const index = state.records.findIndex((r) => r.id === updated.id);
            if (index !== -1) {
                state.records[index] = updated;
            }
        },

        // 삭제
        deleteRecord: (state, action) => {
            const id = action.payload;
            state.records = state.records.filter((r) => r.id !== id);
        },

        // 폴더 이동
        changeRecordFolder: (state, action) => {
            const { id, folder } = action.payload;
            const record = state.records.find((r) => r.id === id);
            if (record) {
                record.folder = folder;
                record.folder_id = folder.id;
            }
        },
    },
});

export const {
    setRecords,
    updateRecord,
    deleteRecord,
    changeRecordFolder,
} = recordSlice.actions;

export default recordSlice.reducer;
