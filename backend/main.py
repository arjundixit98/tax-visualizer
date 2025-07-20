# main.py
# To run this backend:
# 1. Install dependencies: pip install "fastapi[all]" pandas openpyxl numpy
# 2. Run the server: uvicorn main:app --reload

import pandas as pd
import io
import numpy as np
import traceback
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.encoders import jsonable_encoder

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
        # Check if the value in the specified column matches the expected value
        if pd.notna(row.iloc[column_index]) and str(row.iloc[column_index]).strip().lower() == expected_value.lower():
            return i
    return None

def get_detailed_pnl_from_sheet(df_raw, pnl_type):
    """
    Parses a P&L sheet (Equity or MF) to extract detailed short-term and long-term trades.
    """
    st_separator = find_first_valid_row(df_raw, 1, "Short Term Trades")
    lt_separator = find_first_valid_row(df_raw, 1, "Long Term Trades")
    
    trades = []

    # Define the expected columns for P&L details
    pnl_columns = ['Symbol', 'Quantity', 'Buy Value', 'Sell Value', 'Realized P&L']

    if st_separator is not None:
        header_row = st_separator + 1
        # Select the correct rows AND the 5 columns containing the trade data (indices 1 through 5)
        st_data = df_raw.iloc[header_row + 1 : (lt_separator if lt_separator is not None else len(df_raw)), 1:6].copy()
        st_data.columns = pnl_columns
        st_data['term'] = 'Short Term'
        st_data['type'] = pnl_type
        trades.append(st_data)

    if lt_separator is not None:
        header_row = lt_separator + 1
        # Select the correct rows AND the 5 columns containing the trade data (indices 1 through 5)
        lt_data = df_raw.iloc[header_row + 1 :, 1:6].copy()
        lt_data.columns = pnl_columns
        lt_data['term'] = 'Long Term'
        lt_data['type'] = pnl_type
        trades.append(lt_data)

    if not trades:
        return pd.DataFrame()

    combined_trades = pd.concat(trades, ignore_index=True)
    # Clean up the combined dataframe
    combined_trades.dropna(subset=['Symbol'], inplace=True)
    combined_trades = combined_trades[combined_trades['Symbol'] != 'Symbol']
    
    return combined_trades


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
        equity_sheet_name = next((name for name in xls.sheet_names if name.lower() == "equity"), None)
        mf_sheet_name = next((name for name in xls.sheet_names if name.lower() == "mutual funds"), None)
        exits_sheet_name = next((name for name in xls.sheet_names if name.lower().startswith("tradewise exits")), None)

        if not all([equity_sheet_name, mf_sheet_name, exits_sheet_name]):
             raise HTTPException(status_code=400, detail="Required sheets (Equity, Mutual Funds, Tradewise Exits) not found.")

        # --- Read Sheets into DataFrames ---
        df_equity_raw = pd.read_excel(xls, sheet_name=equity_sheet_name, header=None)
        df_mf_raw = pd.read_excel(xls, sheet_name=mf_sheet_name, header=None)
        df_exits_raw = pd.read_excel(xls, sheet_name=exits_sheet_name, header=None)

        # --- Extract Client Name ---
        client_name_row = find_first_valid_row(df_equity_raw, 1, "Client Name")
        client_name = df_equity_raw.iloc[client_name_row, 2] if client_name_row is not None else "Guest"

        # --- Process Summary P&L Data ---
        def get_summary_pnl(df, st_label, lt_label):
            df_indexed = df.set_index(df.columns[1])
            st_val = pd.to_numeric(df_indexed.loc[st_label].iloc[0], errors='coerce')
            lt_val = pd.to_numeric(df_indexed.loc[lt_label].iloc[0], errors='coerce')
            short_term = st_val if np.isfinite(st_val) else 0
            long_term = lt_val if np.isfinite(lt_val) else 0
            return {"shortTerm": short_term, "longTerm": long_term, "total": short_term + long_term}

        equity_pnl_summary = get_summary_pnl(df_equity_raw.dropna(how='all'), 'Short Term profit', 'Long Term profit')
        mf_pnl_summary = get_summary_pnl(df_mf_raw.dropna(how='all'), 'Short Term profit Equity', 'Long Term profit Equity')

        # --- Process Detailed P&L from Equity and MF sheets ---
        equity_pnl_details = get_detailed_pnl_from_sheet(df_equity_raw, 'Equity')
        mf_pnl_details = get_detailed_pnl_from_sheet(df_mf_raw, 'Mutual Fund')
        all_pnl_details = pd.concat([equity_pnl_details, mf_pnl_details], ignore_index=True)

        # --- Process All Transactions from Tradewise Exits sheet ---
        header_row_index = find_first_valid_row(df_exits_raw, 1, "Symbol")
        if header_row_index is None:
            raise HTTPException(status_code=400, detail="Could not find transaction header 'Symbol' in 'Tradewise Exits' sheet.")

        mf_separator_index = find_first_valid_row(df_exits_raw, 1, "Mutual Funds")
        if mf_separator_index is None:
            raise HTTPException(status_code=400, detail="Could not find 'Mutual Funds' separator in 'Tradewise Exits' sheet.")

        column_names = df_exits_raw.iloc[header_row_index].tolist()

        equity_trans_df = df_exits_raw.iloc[header_row_index + 1 : mf_separator_index].copy()
        equity_trans_df.columns = column_names
        equity_trans_df['Type'] = 'Equity'

        mf_trans_df = df_exits_raw.iloc[mf_separator_index + 1 :].copy()
        mf_trans_df.columns = column_names
        mf_trans_df['Type'] = 'Mutual Fund'
        
        all_transactions = pd.concat([equity_trans_df, mf_trans_df], ignore_index=True)
        all_transactions.dropna(subset=['Symbol'], inplace=True)
        all_transactions = all_transactions[all_transactions['Symbol'] != 'Symbol']
        unwanted_patterns = 'Buyback|F&O|Commodity|Currency'
        all_transactions = all_transactions[~all_transactions['Symbol'].str.contains(unwanted_patterns, na=False, case=False)]
        
        # --- Final JSON Structuring ---
        def clean_and_convert_to_json(df, rename_map):
            # Make sure to only work with columns that actually exist in the dataframe
            existing_cols = {k: v for k, v in rename_map.items() if k in df.columns}
            df_renamed = df[list(existing_cols.keys())].rename(columns=existing_cols)

            numeric_cols = [v for k, v in rename_map.items() if k in ['Quantity', 'Buy Value', 'Sell Value', 'Realized P&L', 'Profit', 'Period of Holding']]
            
            for col in numeric_cols:
                if col in df_renamed.columns:
                    df_renamed[col] = pd.to_numeric(df_renamed[col], errors='coerce')
            
            return df_renamed.to_dict(orient='records')

        pnl_details_map = {'Symbol': 'symbol', 'Quantity': 'quantity', 'Buy Value': 'buyValue', 'Sell Value': 'sellValue', 'Realized P&L': 'profit', 'term': 'term', 'type': 'type'}
        pnl_details_json = clean_and_convert_to_json(all_pnl_details, pnl_details_map)

        transactions_map = {'Symbol': 'symbol', 'Entry Date': 'entryDate', 'Exit Date': 'exitDate', 'Quantity': 'quantity', 'Buy Value': 'buyValue', 'Sell Value': 'sellValue', 'Profit': 'profit', 'Period of Holding': 'holdingPeriod', 'Type': 'type'}
        transactions_json = clean_and_convert_to_json(all_transactions, transactions_map)

        final_response = {
            "clientName": client_name,
            "equityPnL": equity_pnl_summary,
            "mutualFundsPnL": mf_pnl_summary,
            "pnlDetails": pnl_details_json,
            "transactions": transactions_json
        }

        # Use FastAPI's jsonable_encoder to handle numpy types and other non-serializable values
        return jsonable_encoder(final_response)

    except Exception as e:
        # Format the full traceback to include in the error response
        error_traceback = traceback.format_exc()
        # Log the error and traceback for server-side debugging
        print(f"An error occurred: {e}\n{error_traceback}")
        # Raise an HTTPException with the detailed traceback
        raise HTTPException(status_code=500, detail=f"An error occurred while processing the file: {error_traceback}")

# To run: uvicorn main:app --reload
