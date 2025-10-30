import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import apiClient from "../../api/apiClient";
import { API_BASE_URL } from "../../config";

// ✅ 초기 상태 (하드코딩 제거)
const initialState = {
    folders: [],
    status: "idle",
    error: null,
};

/* ──────────────────────────────────────────────────────────────
   📡 Thunks — API 연동
────────────────────────────────────────────────────────────── */

// 🔹 모든 폴더 불러오기 (GET /folders)
export const fetchFolders = createAsyncThunk(
    "folder/fetchFolders",
    async (_, { rejectWithValue }) => {
        try {
            const res = await apiClient.get(`${API_BASE_URL}/folders/`, {
                withCredentials: true,
            });
            return res.data.folders; // 백엔드가 {"folders": [...]} 형태 반환 중
        } catch (err) {
            console.error("폴더 목록 불러오기 실패:", err);
            return rejectWithValue(err.response?.data || "폴더 조회 실패");
        }
    }
);

// 🔹 폴더 생성 (POST /folders)
export const addFolderAsync = createAsyncThunk(
    "folder/addFolderAsync",
    async (name, { rejectWithValue }) => {
        try {
            const res = await apiClient.post(
                `${API_BASE_URL}/folders/`,
                { name },
                { withCredentials: true }
            );
            return res.data;
        } catch (err) {
            console.error("폴더 생성 실패:", err);
            return rejectWithValue(err.response?.data || "폴더 생성 실패");
        }
    }
);

// 🔹 폴더 이름 변경 (PATCH /folders/{id})
export const renameFolderAsync = createAsyncThunk(
    "folder/renameFolderAsync",
    async ({ id, name }, { rejectWithValue }) => {
        try {
            const res = await apiClient.patch(
                `${API_BASE_URL}/folders/${id}`,
                { name },
                { withCredentials: true }
            );
            return res.data;
        } catch (err) {
            console.error("폴더 이름 수정 실패:", err);
            return rejectWithValue(err.response?.data || "폴더 수정 실패");
        }
    }
);
// 🔹 폴더 색상 변경 (PATCH /folders/{id})
export const updateFolderColorAsync = createAsyncThunk(
    "folder/updateFolderColorAsync",
    async ({ id, color }, { rejectWithValue }) => {
        try {
            const res = await apiClient.patch(
                `${API_BASE_URL}/folders/${id}`,
                { color },
                { withCredentials: true }
            );
            return res.data;
        } catch (err) {
            console.error("폴더 색상 변경 실패:", err);
            return rejectWithValue(err.response?.data || "폴더 색상 변경 실패");
        }
    }
);

// 🔹 폴더 삭제 (DELETE /folders/{id})
export const deleteFolderAsync = createAsyncThunk(
    "folder/deleteFolderAsync",
    async (id, { rejectWithValue }) => {
        try {
            const res = await apiClient.delete(`${API_BASE_URL}/folders/${id}`, {
                withCredentials: true,
            });
            return res.data;
        } catch (err) {
            console.error("폴더 삭제 실패:", err);
            return rejectWithValue(err.response?.data || "폴더 삭제 실패");
        }
    }
);

/* ──────────────────────────────────────────────────────────────
   🧩 Slice 정의
────────────────────────────────────────────────────────────── */

const folderSlice = createSlice({
    name: "folder",
    initialState,
    reducers: {},

    extraReducers: (builder) => {
        builder
            // 🔹 폴더 전체 조회
            .addCase(fetchFolders.pending, (state) => {
                state.status = "loading";
            })
            .addCase(fetchFolders.fulfilled, (state, action) => {
                state.status = "succeeded";
                state.folders = action.payload;
            })
            .addCase(fetchFolders.rejected, (state, action) => {
                state.status = "failed";
                state.error = action.payload;
            })

            // 🔹 폴더 생성
            .addCase(addFolderAsync.fulfilled, (state, action) => {
                state.folders.push(action.payload);
            })

            // 🔹 폴더 이름 변경
            .addCase(renameFolderAsync.fulfilled, (state, action) => {
                const updated = action.payload;
                const folder = state.folders.find((f) => f.id === updated.id);
                if (folder) folder.name = updated.name;
            })

            // 🔹 폴더 삭제
            .addCase(deleteFolderAsync.fulfilled, (state, action) => {
                const deleted = action.payload;
                state.folders = state.folders.filter((f) => f.id !== deleted.id);
            })

            // 🔹 폴더 색상 변경
            .addCase(updateFolderColorAsync.fulfilled, (state, action) => {
                const updated = action.payload.folder || action.payload; // 둘 다 대응
                const folder = state.folders.find((f) => f.id === updated.id);
                if (folder) folder.color = updated.color;
            });
    }, // ✅ extraReducers 닫힘
}); // ✅ createSlice 닫힘
export default folderSlice.reducer;
