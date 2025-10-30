// src/app/store.js
import { configureStore } from "@reduxjs/toolkit";
import folderReducer from "../features/folder/folderSlice";
import recordReducer from "../features/record/recordSlice";
import authReducer from "../features/auth/authSlice";

export const store = configureStore({
    reducer: {
        auth: authReducer,
        folder: folderReducer,
        record: recordReducer,
    },
});