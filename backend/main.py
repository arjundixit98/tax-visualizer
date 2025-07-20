# main.py
# To run this backend:
# 1. Install dependencies: pip install "fastapi[all]" pandas openpyxl numpy
# 2. Run the server: uvicorn main:app --reload

import pandas as pd
import io
import numpy as np
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

# --- CORS Middleware ---
# This is crucial to allow your React frontend (running on a different port)
# to communicate with this backend.
origins = [
    "http://localhost:3000",  # Default React dev server port
    "http://localhost:5173",  # Default Vite dev server port
    # Add any other origins if needed
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def find_first_valid_row(df, column_index, expected_value):
    """Finds the index of the first row where a specific column contains an expected value."""
    for i, row in df.iterrows():
        if str(row.iloc[column_index]).strip().lower() == expected_value.lower():
            return i
    return None

@app.post("/process-pnl")
async def process_pnl_file(file: UploadFile = File(...)):
    """
    This endpoint accepts an Excel file, processes the relevant sheets using Pandas,
    and returns a structured JSON object with P&L and transaction data.
    """
    if not file.filename.endswith(('.xlsx', '.xls')):
        raise HTTPException(status_code=400, detail="Invalid file type. Please upload an Excel file.")

    try:
        contents = await file.read()
        xls = pd.ExcelFile(io.BytesIO(contents))

        # --- Sheet Name Validation ---
        sheet_names = [name.lower() for name in xls.sheet_names]
        required_sheets = {
            "equity": "equity",
            "mutual_funds": "mutual funds",
            "tradewise_exits": "tradewise exits"
        }

        # Find the actual sheet names, handling variations
        equity_sheet = next((name for name in xls.sheet_names if name.lower() == required_sheets["equity"]), None)
        mf_sheet = next((name for name in xls.sheet_names if name.lower() == required_sheets["mutual_funds"]), None)
        exits_sheet = next((name for name in xls.sheet_names if name.lower().startswith(required_sheets["tradewise_exits"])), None)

        if not all([equity_sheet, mf_sheet, exits_sheet]):
             raise HTTPException(status_code=400, detail="Required sheets (Equity, Mutual Funds, Tradewise Exits) not found.")

        # --- Read Sheets into DataFrames ---
        df_equity = pd.read_excel(xls, sheet_name=equity_sheet, header=None)
        df_mf = pd.read_excel(xls, sheet_name=mf_sheet, header=None)
        df_exits_raw = pd.read_excel(xls, sheet_name=exits_sheet, header=None)

        # --- Extract Client Name ---
        client_name_row = find_first_valid_row(df_equity, 1, "Client Name")
        client_name = df_equity.iloc[client_name_row, 2] if client_name_row is not None else "Guest"

        # --- Process P&L Data ---
        def get_pnl_from_df(df, st_label, lt_label):
            # Use the second column as the index for easy lookup
            df_indexed = df.set_index(df.columns[1])
            
            # Extract values using the new index
            st_val = pd.to_numeric(df_indexed.loc[st_label].iloc[0], errors='coerce')
            lt_val = pd.to_numeric(df_indexed.loc[lt_label].iloc[0], errors='coerce')
            
            short_term = st_val if pd.notna(st_val) else 0
            long_term = lt_val if pd.notna(lt_val) else 0
            return {"shortTerm": short_term, "longTerm": long_term, "total": short_term + long_term}

        equity_pnl = get_pnl_from_df(df_equity.dropna(how='all'), 'Short Term profit', 'Long Term profit')
        mf_pnl = get_pnl_from_df(df_mf.dropna(how='all'), 'Short Term profit Equity', 'Long Term profit Equity')

        # --- Process Tradewise Exits ---
        header_row_index = find_first_valid_row(df_exits_raw, 1, "Symbol")
        if header_row_index is None:
            raise HTTPException(status_code=400, detail="Could not find transaction header in 'Tradewise Exits' sheet.")

        df_exits = pd.read_excel(xls, sheet_name=exits_sheet, header=header_row_index)
        df_exits = df_exits.dropna(how='all').reset_index(drop=True)
        
        # Find boundaries for Equity and Mutual Fund sections
        equity_start_index = df_exits[df_exits['Symbol'].str.contains('Equity', na=False)].index[0]
        mf_start_index = df_exits[df_exits['Symbol'].str.contains('Mutual Fund', na=False)].index[0]

        equity_trans = df_exits.iloc[equity_start_index + 1 : mf_start_index].copy()
        equity_trans['Type'] = 'Equity'

        mf_trans = df_exits.iloc[mf_start_index + 1 :].copy()
        mf_trans['Type'] = 'Mutual Fund'

        all_transactions = pd.concat([equity_trans, mf_trans], ignore_index=True)

        # Clean and select final columns
        final_cols = {
            'Symbol': 'symbol', 'Entry Date': 'entryDate', 'Exit Date': 'exitDate',
            'Quantity': 'quantity', 'Buy Value': 'buyValue', 'Sell Value': 'sellValue',
            'Profit': 'profit', 'Period of Holding': 'holdingPeriod', 'Type': 'type'
        }
        all_transactions = all_transactions[list(final_cols.keys())].rename(columns=final_cols)
        
        # --- Data Cleaning for JSON Compliance ---
        # Convert numeric columns, coercing errors to NaN
        numeric_cols = ['quantity', 'buyValue', 'sellValue', 'profit', 'holdingPeriod']
        for col in numeric_cols:
            all_transactions[col] = pd.to_numeric(all_transactions[col], errors='coerce')
            
        # Replace non-JSON compliant values (inf, -inf, NaN, NaT) with None, which becomes `null` in JSON
        # Step 1: Replace infinities with NaN, as pandas handles NaN more consistently.
        all_transactions.replace([np.inf, -np.inf], np.nan, inplace=True)
        # Step 2: Replace all occurrences of NaN (which now includes original NaNs, NaTs, and infinities) with None.
        all_transactions = all_transactions.where(pd.notna(all_transactions), None)

        # Step 3 (Optional but good practice): Fill any remaining None in numeric columns with 0.
        for col in numeric_cols:
             if col in all_transactions.columns:
                all_transactions[col] = all_transactions[col].fillna(0)

        transactions_json = all_transactions.to_dict(orient='records')

        return {
            "clientName": client_name,
            "equityPnL": equity_pnl,
            "mutualFundsPnL": mf_pnl,
            "transactions": transactions_json
        }

    except Exception as e:
        # Catch any other exceptions during processing
        raise HTTPException(status_code=500, detail=f"An error occurred while processing the file: {e}")

# To run: uvicorn main:app --reload
