// //src/features/record/recordSlice.js
// import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
// import apiClient from "../../api/apiClient";
// import { API_BASE_URL } from "../../config";
//
// const initialState = {
//     records: [],
//     status: "idle",
//     error: null,
// };
//
// /* ───────────────────────────────────────────────
//    📡 서버에서 전체 회의(boards) 목록 불러오기
// ─────────────────────────────────────────────── */
// export const fetchRecords = createAsyncThunk(
//     "record/fetchRecords",
//     async (_, { rejectWithValue }) => {
//         try {
//             const res = await apiClient.get(`${API_BASE_URL}/boards`, {
//                 withCredentials: true,
//             });
//             return res.data; // 백엔드가 boards 배열 반환
//         } catch (err) {
//             console.error("회의 목록 불러오기 실패:", err);
//             return rejectWithValue(err.response?.data || "회의 목록 불러오기 실패");
//         }
//     }
// );
//
// const recordSlice = createSlice({
//     name: "record",
//     initialState,
//     reducers: {
//         // 전체 세팅
//         setRecords: (state, action) => {
//             state.records = action.payload;
//         },
//
//         // 하나 업데이트 (이름, 폴더 등)
//         updateRecord: (state, action) => {
//             const updated = action.payload;
//             const index = state.records.findIndex((r) => r.id === updated.id);
//             if (index !== -1) {
//                 state.records[index] = updated;
//             } else {
//                 state.records.push(updated);
//             }
//         },
//
//         // 삭제
//         deleteRecord: (state, action) => {
//             const id = action.payload;
//             state.records = state.records.filter((r) => r.id !== id);
//         },
//
//         // 폴더 이동
//         changeRecordFolder: (state, action) => {
//             const { id, folder } = action.payload;
//             const record = state.records.find((r) => r.id === id);
//             if (record) {
//                 record.folder = folder;
//                 record.folder_id = folder.id;
//             }
//         },
//     },
//     extraReducers: (builder) => {
//         builder
//             .addCase(fetchRecords.pending, (state) => {
//                 state.status = "loading";
//             })
//             .addCase(fetchRecords.fulfilled, (state, action) => {
//                 state.records = action.payload;
//                 state.status = "succeeded";
//             })
//             .addCase(fetchRecords.rejected, (state, action) => {
//                 state.status = "failed";
//                 state.error = action.payload;
//             });
//     },
// });
//
// export const { setRecords, updateRecord, deleteRecord, changeRecordFolder } =
//     recordSlice.actions;
// export default recordSlice.reducer;

// src/features/record/recordSlice.js
import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import apiClient from "../../api/apiClient";
import { API_BASE_URL } from "../../config";

const initialState = {
    records: [],
    status: "idle", // idle | loading | succeeded | failed
    error: null,
    lastFetch: null, // ⭐ 마지막 fetch 시간
    cacheTimeout: 5 * 60 * 1000, // ⭐ 5분 캐시
};

/* ⭐ 캐시 유효성 검사 */
const isCacheValid = (lastFetch, timeout) => {
    if (!lastFetch) return false;
    return Date.now() - lastFetch < timeout;
};

/* ⭐ 조건부 fetch (캐싱 적용) */
export const fetchRecords = createAsyncThunk(
    "record/fetchRecords",
    async (forceRefresh = false, { getState, rejectWithValue }) => {
        const state = getState().record;

        // 캐시가 유효하면 스킵
        if (!forceRefresh && isCacheValid(state.lastFetch, state.cacheTimeout)) {
            console.log("✅ 캐시 사용 - API 요청 스킵");
            return state.records;
        }

        try {
            console.log("🔄 API 요청 - 새 데이터 fetch");
            const res = await apiClient.get(`${API_BASE_URL}/boards`, {
                withCredentials: true,
            });
            return res.data;
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
        // ⭐ 전체 세팅 (기존 유지)
        setRecords: (state, action) => {
            state.records = action.payload;
        },

        // ⭐ 하나 업데이트 (기존 유지)
        updateRecord: (state, action) => {
            const updated = action.payload;
            const index = state.records.findIndex((r) => r.id === updated.id);
            if (index !== -1) {
                state.records[index] = updated;
            } else {
                state.records.push(updated);
            }
        },

        // ⭐ 삭제 (기존 유지)
        deleteRecord: (state, action) => {
            const id = action.payload;
            state.records = state.records.filter((r) => r.id !== id);
        },

        // ⭐ 폴더 이동 (기존 유지)
        changeRecordFolder: (state, action) => {
            const { id, folder, recordId, folderId } = action.payload;

            // 두 가지 형식 모두 지원
            const targetId = id || recordId;
            const targetFolderId = folderId || folder?.id;

            const record = state.records.find((r) => r.id === targetId);
            if (record) {
                record.folder = folder;
                record.folder_id = targetFolderId;
            }
        },

        // ⭐ 수동 캐시 무효화
        invalidateCache: (state) => {
            state.lastFetch = null;
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
                state.lastFetch = Date.now(); // ⭐ 캐시 타임스탬프 저장
            })
            .addCase(fetchRecords.rejected, (state, action) => {
                state.status = "failed";
                state.error = action.payload;
            });
    },
});

export const {
    setRecords,
    updateRecord,
    deleteRecord,
    changeRecordFolder,
    invalidateCache
} = recordSlice.actions;

export default recordSlice.reducer;