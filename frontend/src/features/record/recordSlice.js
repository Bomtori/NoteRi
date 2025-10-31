// src/features/record/recordSlice.js
import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import apiClient from "../../api/apiClient";
import { API_BASE_URL } from "../../config";

const initialState = {
    records: [],
    status: "idle",
    error: null,
};

/* ───────────────────────────────────────────────
   📡 서버에서 전체 회의(boards) 목록 불러오기
─────────────────────────────────────────────── */
export const fetchRecords = createAsyncThunk(
    "record/fetchRecords",
    async (_, { rejectWithValue }) => {
        try {
            const res = await apiClient.get(`${API_BASE_URL}/boards`, {
                withCredentials: true,
            });
            return res.data; // 백엔드가 boards 배열 반환
        } catch (err) {
            console.error("회의 목록 불러오기 실패:", err);
            return rejectWithValue(err.response?.data || "회의 목록 불러오기 실패");
        }
    }
);

const recordSlice = createSlice({
    name: "record",
    initialState,
    reducers: {
        // 전체 세팅
        setRecords: (state, action) => {
            state.records = action.payload;
        },

        // 하나 업데이트 (이름, 폴더 등)
        updateRecord: (state, action) => {
            const updated = action.payload;
            const index = state.records.findIndex((r) => r.id === updated.id);
            if (index !== -1) {
                state.records[index] = updated;
            } else {
                state.records.push(updated);
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
    extraReducers: (builder) => {
        builder
            .addCase(fetchRecords.pending, (state) => {
                state.status = "loading";
            })
            .addCase(fetchRecords.fulfilled, (state, action) => {
                state.records = action.payload;
                state.status = "succeeded";
            })
            .addCase(fetchRecords.rejected, (state, action) => {
                state.status = "failed";
                state.error = action.payload;
            });
    },
});

export const { setRecords, updateRecord, deleteRecord, changeRecordFolder } =
    recordSlice.actions;
export default recordSlice.reducer;
