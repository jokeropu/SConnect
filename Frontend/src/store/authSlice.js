import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { authApi } from '../api/endpoints';
import { setAccessToken, errorMessage } from '../api/axiosClient';
import { disconnectSocket } from '../api/socket';

export const registerUser = createAsyncThunk('auth/register', async (payload, { rejectWithValue }) => {
  try {
    return await authApi.register(payload);
  } catch (error) {
    return rejectWithValue({ message: errorMessage(error) });
  }
});

export const loginUser = createAsyncThunk('auth/login', async (payload, { rejectWithValue }) => {
  try {
    const data = await authApi.login(payload);
    setAccessToken(data.accessToken);
    return data.user;
  } catch (error) {
    return rejectWithValue({ message: errorMessage(error) });
  }
});

export const googleAuth = createAsyncThunk('auth/google', async (credential, { rejectWithValue }) => {
  try {
    const data = await authApi.google(credential);
    setAccessToken(data.accessToken);
    return data.user;
  } catch (error) {
    return rejectWithValue({ message: errorMessage(error) });
  }
});

export const checkAuth = createAsyncThunk('auth/check', async (_, { rejectWithValue }) => {
  try {
    const data = await authApi.refresh();
    setAccessToken(data.accessToken);
    return data.user;
  } catch (error) {
    if (error.response?.status === 401) return rejectWithValue(null);
    return rejectWithValue({ message: errorMessage(error) });
  }
});

export const logoutUser = createAsyncThunk('auth/logout', async (_, { rejectWithValue }) => {
  try {
    await authApi.logout();
    setAccessToken(null);
    disconnectSocket();
    return null;
  } catch (error) {
    setAccessToken(null);
    disconnectSocket();
    return rejectWithValue({ message: errorMessage(error) });
  }
});

const authSlice = createSlice({
  name: 'auth',
  initialState: {
    user: null,
    isAuthenticated: false,
    booting: true,
    loading: false,
    error: null,
    registered: null,
  },
  reducers: {
    updateUserProfile: (state, action) => {
      if (state.user) {
        state.user = { ...state.user, ...action.payload };
      }
    },
    clearAuthError: (state) => {
      state.error = null;
      state.registered = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(registerUser.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.registered = null;
      })
      .addCase(registerUser.fulfilled, (state, action) => {
        state.loading = false;
        state.registered = action.payload?.message || 'Account created';
      })
      .addCase(registerUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message || 'Something went wrong';
      })

      .addCase(loginUser.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.loading = false;
        state.isAuthenticated = !!action.payload;
        state.user = action.payload;
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message || 'Something went wrong';
        state.isAuthenticated = false;
        state.user = null;
      })

      .addCase(googleAuth.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(googleAuth.fulfilled, (state, action) => {
        state.loading = false;
        state.isAuthenticated = !!action.payload;
        state.user = action.payload;
      })
      .addCase(googleAuth.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message || 'Something went wrong';
        state.isAuthenticated = false;
        state.user = null;
      })

      .addCase(checkAuth.pending, (state) => {
        state.booting = true;
        state.loading = true;
        state.error = null;
      })
      .addCase(checkAuth.fulfilled, (state, action) => {
        state.booting = false;
        state.loading = false;
        state.isAuthenticated = !!action.payload;
        state.user = action.payload;
      })
      .addCase(checkAuth.rejected, (state, action) => {
        state.booting = false;
        state.loading = false;
        state.error = action.payload ? action.payload?.message : null;
        state.isAuthenticated = false;
        state.user = null;
      })

      .addCase(logoutUser.pending, (state) => {
        state.loading = true;
      })
      .addCase(logoutUser.fulfilled, (state) => {
        state.loading = false;
        state.user = null;
        state.isAuthenticated = false;
        state.error = null;
      })
      .addCase(logoutUser.rejected, (state) => {
        state.loading = false;
        state.user = null;
        state.isAuthenticated = false;
      });
  },
});

export const { updateUserProfile, clearAuthError } = authSlice.actions;
export default authSlice.reducer;
