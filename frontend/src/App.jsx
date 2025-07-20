import React, { useState, useMemo, useCallback } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Sector,
} from "recharts";
import { UploadCloud, FileText, AlertTriangle, RefreshCw } from "lucide-react";
import { useDropzone } from "react-dropzone";

// --- Helper: XLSX Script Loader ---
// This ensures the XLSX library is available for parsing Excel files.
const loadXlsxScript = (callback) => {
  if (window.XLSX) {
    callback();
    return;
  }
  const script = document.createElement("script");
  script.src =
    "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
  script.onload = () => callback();
  document.head.appendChild(script);
};

// --- Data Parsing Functions ---

const parseClientName = (csv) => {
  const lines = csv.trim().split("\n");
  for (const line of lines) {
    const columns = line.split(",");
    if (columns[1] && columns[1].toLowerCase().includes("client name")) {
      return columns[2] || "Guest";
    }
  }
  return "Guest";
};

const parsePnL = (csv, type) => {
  const lines = csv.trim().split("\n");
  let shortTerm = 0;
  let longTerm = 0;

  lines.forEach((line) => {
    const columns = line.split(",");
    // Ensure the line has enough columns and a label in the second column.
    if (columns.length > 2 && columns[1]) {
      const label = columns[1].trim().toLowerCase();
      const value = parseFloat(columns[2]);

      // Skip if the parsed value is not a number.
      if (isNaN(value)) {
        return;
      }

      if (type === "equity") {
        // Use exact matching for labels to avoid ambiguity.
        if (label === "short term profit") {
          shortTerm = value;
        } else if (label === "long term profit") {
          longTerm = value;
        }
      } else if (type === "mutual_fund") {
        if (label === "short term profit equity") {
          shortTerm = value;
        } else if (label === "long term profit equity") {
          longTerm = value;
        }
      }
    }
  });

  return { shortTerm, longTerm, total: shortTerm + longTerm };
};

const parseTradewiseExits = (csv) => {
  // console.log(csv);
  const lines = csv.trim().split("\n");
  const data = [];
  let isEquity = false;
  let isMutualFund = false;

  lines.forEach((line) => {
    const columns = line.split(",");
    if (columns[1] && columns[1].toLowerCase().trim() === "equity") {
      isEquity = true;
      isMutualFund = false;
      return;
    }
    if (columns[1] && columns[1].toLowerCase().trim() === "mutual funds") {
      isEquity = false;
      isMutualFund = true;
      return;
    }

    if (columns[1] && columns[1].toLowerCase().trim() === "symbol") {
      return;
    }

    if ((isEquity || isMutualFund) && columns.length === 13 && columns[1]) {
      // Check if essential numeric columns can be parsed as numbers
      console.log(line, columns.length);
      if (!isNaN(parseFloat(columns[6])) && !isNaN(parseFloat(columns[7]))) {
        data.push({
          symbol: columns[1],
          isin: columns[2],
          entryDate: columns[3],
          exitDate: columns[4],
          quantity: parseFloat(columns[5]) || 0,
          buyValue: parseFloat(columns[6]) || 0,
          sellValue: parseFloat(columns[7]) || 0,
          profit: parseFloat(columns[8]) || 0,
          holdingPeriod: parseInt(columns[9], 10) || 0,
          type: isEquity ? "Equity" : "Mutual Fund",
        });
      }
    }
  });
  // console.log(data);
  return data;
};

// --- Helper Components ---

const StatCard = ({ title, value, subtitle }) => {
  const isPositive = value >= 0;
  const colorClass = isPositive ? "text-green-500" : "text-red-500";
  const formattedValue = `₹${Math.abs(value).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-lg transition-transform transform hover:scale-105">
      <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
        {title}
      </h3>
      <p className={`text-3xl font-bold mt-2 ${colorClass}`}>
        {isPositive ? "+" : "-"}
        {formattedValue}
      </p>
      {subtitle && (
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
          {subtitle}
        </p>
      )}
    </div>
  );
};

const PnLCard = ({ title, data, icon }) => (
  <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-lg">
    <div className="flex items-center mb-4">
      {icon}
      <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 ml-3">
        {title}
      </h2>
    </div>
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <StatCard title="Short Term P&L" value={data.shortTerm} />
      <StatCard title="Long Term P&L" value={data.longTerm} />
      <StatCard title="Total Realized P&L" value={data.total} />
    </div>
  </div>
);

const renderActiveShape = (props) => {
  const RADIAN = Math.PI / 180;
  const {
    cx,
    cy,
    midAngle,
    innerRadius,
    outerRadius,
    startAngle,
    endAngle,
    fill,
    payload,
    percent,
    value,
  } = props;
  const sin = Math.sin(-RADIAN * midAngle);
  const cos = Math.cos(-RADIAN * midAngle);
  const sx = cx + (outerRadius + 10) * cos;
  const sy = cy + (outerRadius + 10) * sin;
  const mx = cx + (outerRadius + 30) * cos;
  const my = cy + (outerRadius + 30) * sin;
  const ex = mx + (cos >= 0 ? 1 : -1) * 22;
  const ey = my;
  const textAnchor = cos >= 0 ? "start" : "end";

  return (
    <g>
      <text
        x={cx}
        y={cy}
        dy={8}
        textAnchor="middle"
        fill={fill}
        className="font-bold text-lg"
      >
        {payload.name}
      </text>
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius}
        outerRadius={outerRadius}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
      />
      <Sector
        cx={cx}
        cy={cy}
        startAngle={startAngle}
        endAngle={endAngle}
        innerRadius={outerRadius + 6}
        outerRadius={outerRadius + 10}
        fill={fill}
      />
      <path
        d={`M${sx},${sy}L${mx},${my}L${ex},${ey}`}
        stroke={fill}
        fill="none"
      />
      <circle cx={ex} cy={ey} r={2} fill={fill} stroke="none" />
      <text
        x={ex + (cos >= 0 ? 1 : -1) * 12}
        y={ey}
        textAnchor={textAnchor}
        fill="#333"
        className="dark:fill-gray-300"
      >{`P/L ₹${value.toLocaleString("en-IN")}`}</text>
      <text
        x={ex + (cos >= 0 ? 1 : -1) * 12}
        y={ey}
        dy={18}
        textAnchor={textAnchor}
        fill="#999"
      >
        {`( ${(percent * 100).toFixed(2)}% )`}
      </text>
    </g>
  );
};

// --- Page Components ---

const SummaryPage = ({ equityPnL, mutualFundsPnL }) => {
  const overallPnL = {
    shortTerm: equityPnL.shortTerm + mutualFundsPnL.shortTerm,
    longTerm: equityPnL.longTerm + mutualFundsPnL.longTerm,
    total: equityPnL.total + mutualFundsPnL.total,
  };

  const barChartData = [
    {
      name: "Equity",
      "Short Term": equityPnL.shortTerm,
      "Long Term": equityPnL.longTerm,
    },
    {
      name: "Mutual Funds",
      "Short Term": mutualFundsPnL.shortTerm,
      "Long Term": mutualFundsPnL.longTerm,
    },
  ];

  const [activeIndex, setActiveIndex] = useState(0);

  const pieChartData = [
    { name: "Equity P&L", value: equityPnL.total },
    { name: "Mutual Fund P&L", value: mutualFundsPnL.total },
  ].filter((d) => d.value !== 0);

  const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042"];

  const onPieEnter = (_, index) => {
    setActiveIndex(index);
  };

  return (
    <div className="space-y-8">
      <PnLCard
        title="Overall P&L"
        data={overallPnL}
        icon={
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-8 w-8 text-indigo-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6"
            />
          </svg>
        }
      />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <PnLCard
          title="Equity P&L"
          data={equityPnL}
          icon={
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-8 w-8 text-blue-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          }
        />
        <PnLCard
          title="Mutual Funds P&L"
          data={mutualFundsPnL}
          icon={
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-8 w-8 text-teal-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          }
        />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-lg">
          <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-4">
            P&L Breakdown
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={barChartData}
              margin={{ top: 5, right: 20, left: -10, bottom: 5 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                className="stroke-gray-200 dark:stroke-gray-700"
              />
              <XAxis dataKey="name" className="text-xs dark:fill-gray-400" />
              <YAxis
                tickFormatter={(value) => `₹${value / 1000}k`}
                className="text-xs dark:fill-gray-400"
              />
              <Tooltip
                formatter={(value) => `₹${value.toLocaleString("en-IN")}`}
                contentStyle={{
                  backgroundColor: "rgba(255, 255, 255, 0.8)",
                  backdropFilter: "blur(5px)",
                  border: "1px solid #ccc",
                  borderRadius: "10px",
                  color: "#333",
                }}
                labelStyle={{ fontWeight: "bold" }}
              />
              <Legend />
              <Bar
                dataKey="Short Term"
                stackId="a"
                fill="#ef4444"
                radius={[10, 10, 0, 0]}
                barSize={30}
              />
              <Bar
                dataKey="Long Term"
                stackId="a"
                fill="#22c55e"
                radius={[10, 10, 0, 0]}
                barSize={30}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-lg">
          <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-4">
            P&L Contribution
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                activeIndex={activeIndex}
                activeShape={renderActiveShape}
                data={pieChartData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
                onMouseEnter={onPieEnter}
              >
                {pieChartData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={COLORS[index % COLORS.length]}
                  />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

const TransactionsPage = ({ transactions }) => {
  const [filter, setFilter] = useState("All");

  const filteredTransactions = useMemo(() => {
    if (filter === "All") return transactions;
    return transactions.filter((t) => t.type === filter);
  }, [filter, transactions]);

  const totalProfit = useMemo(() => {
    return filteredTransactions.reduce((acc, t) => acc + t.profit, 0);
  }, [filteredTransactions]);

  return (
    <div className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-2xl shadow-lg">
      <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
          Granular Transactions
        </h2>
        <div className="flex items-center space-x-2 bg-gray-100 dark:bg-gray-700 p-1 rounded-full">
          {["All", "Equity", "Mutual Fund"].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 text-sm font-semibold rounded-full transition-colors ${
                filter === f
                  ? "bg-indigo-500 text-white shadow"
                  : "text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-4 text-right">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Showing {filteredTransactions.length} transactions
        </p>
        <p className="text-lg font-bold">
          Total P/L:
          <span
            className={totalProfit >= 0 ? "text-green-500" : "text-red-500"}
          >
            {" "}
            ₹
            {totalProfit.toLocaleString("en-IN", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </span>
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
          <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400 sticky top-0">
            <tr>
              <th scope="col" className="px-6 py-3">
                Symbol
              </th>
              <th scope="col" className="px-6 py-3">
                Type
              </th>
              <th scope="col" className="px-6 py-3">
                Entry Date
              </th>
              <th scope="col" className="px-6 py-3">
                Exit Date
              </th>
              <th scope="col" className="px-6 py-3 text-right">
                Buy Value
              </th>
              <th scope="col" className="px-6 py-3 text-right">
                Sell Value
              </th>
              <th scope="col" className="px-6 py-3 text-right">
                Profit/Loss
              </th>
              <th scope="col" className="px-6 py-3 text-right">
                Holding (Days)
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredTransactions.map((t, index) => (
              <tr
                key={index}
                className="bg-white border-b dark:bg-gray-800 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600"
              >
                <th
                  scope="row"
                  className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap dark:text-white"
                >
                  {t.symbol}
                </th>
                <td className="px-6 py-4">
                  <span
                    className={`px-2 py-1 text-xs font-medium rounded-full ${
                      t.type === "Equity"
                        ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300"
                        : "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-300"
                    }`}
                  >
                    {t.type}
                  </span>
                </td>
                <td className="px-6 py-4">{t.entryDate}</td>
                <td className="px-6 py-4">{t.exitDate}</td>
                <td className="px-6 py-4 text-right">
                  ₹{t.buyValue.toLocaleString("en-IN")}
                </td>
                <td className="px-6 py-4 text-right">
                  ₹{t.sellValue.toLocaleString("en-IN")}
                </td>
                <td
                  className={`px-6 py-4 text-right font-bold ${
                    t.profit >= 0 ? "text-green-500" : "text-red-500"
                  }`}
                >
                  ₹
                  {t.profit.toLocaleString("en-IN", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </td>
                <td className="px-6 py-4 text-right">{t.holdingPeriod}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {filteredTransactions.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500 dark:text-gray-400">
            No transactions found for this filter.
          </p>
        </div>
      )}
    </div>
  );
};

// --- Main App Component ---

export default function App() {
  const [page, setPage] = useState("summary");
  const [clientName, setClientName] = useState("Guest");
  const [equityPnL, setEquityPnL] = useState(null);
  const [mutualFundsPnL, setMutualFundsPnL] = useState(null);
  const [transactions, setTransactions] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleFileUpload = useCallback((acceptedFiles) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setIsLoading(true);
    setError(null);

    loadXlsxScript(() => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = window.XLSX.read(data, { type: "array" });

          const equitySheetName = workbook.SheetNames.find(
            (name) => name.toLowerCase() === "equity"
          );
          const mfSheetName = workbook.SheetNames.find(
            (name) => name.toLowerCase() === "mutual funds"
          );
          const exitsSheetName = workbook.SheetNames.find((name) =>
            name.toLowerCase().startsWith("tradewise exits")
          );

          if (!equitySheetName || !mfSheetName || !exitsSheetName) {
            throw new Error(
              "Required sheets (Equity, Mutual Funds, Tradewise Exits) not found in the Excel file."
            );
          }

          const equitySheet = workbook.Sheets[equitySheetName];
          const mfSheet = workbook.Sheets[mfSheetName];
          const exitsSheet = workbook.Sheets[exitsSheetName];

          const equityCSV = window.XLSX.utils.sheet_to_csv(equitySheet);
          const mfCSV = window.XLSX.utils.sheet_to_csv(mfSheet);
          const exitsCSV = window.XLSX.utils.sheet_to_csv(exitsSheet);
          setClientName(parseClientName(equityCSV));
          setEquityPnL(parsePnL(equityCSV, "equity"));
          setMutualFundsPnL(parsePnL(mfCSV, "mutual_fund"));
          setTransactions(parseTradewiseExits(exitsCSV));
        } catch (err) {
          console.error(err);
          setError(
            err.message || "An error occurred while processing the file."
          );
        } finally {
          setIsLoading(false);
        }
      };
      reader.onerror = () => {
        setError("Failed to read the file.");
        setIsLoading(false);
      };
      reader.readAsArrayBuffer(file);
    });
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: handleFileUpload,
    accept: {
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [
        ".xlsx",
      ],
      "application/vnd.ms-excel": [".xls"],
    },
    multiple: false,
  });

  const resetApp = () => {
    setEquityPnL(null);
    setMutualFundsPnL(null);
    setTransactions(null);
    setClientName("Guest");
    setError(null);
    setIsLoading(false);
  };

  if (!equityPnL || !mutualFundsPnL || !transactions) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col items-center justify-center p-4 text-center">
        <div className="w-full max-w-lg">
          <div
            {...getRootProps()}
            className={`p-10 border-2 border-dashed rounded-2xl cursor-pointer transition-colors ${
              isDragActive
                ? "border-indigo-500 bg-indigo-50 dark:bg-gray-800"
                : "border-gray-300 dark:border-gray-600 hover:border-indigo-400"
            }`}
          >
            <input {...getInputProps()} />
            <div className="flex flex-col items-center justify-center text-gray-500 dark:text-gray-400">
              <UploadCloud className="w-16 h-16 mb-4 text-gray-400" />
              <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2">
                Import Your P&L Report
              </h2>
              <p>
                Drag & drop your .xlsx file here, or click to select a file.
              </p>
              <p className="text-xs mt-2">(e.g., taxpnl-XXXXXX.xlsx)</p>
            </div>
          </div>

          {isLoading && (
            <div className="mt-6 flex items-center justify-center">
              <RefreshCw className="w-6 h-6 animate-spin mr-2 text-indigo-500" />
              <span className="text-lg text-gray-600 dark:text-gray-300">
                Processing your report...
              </span>
            </div>
          )}

          {error && (
            <div className="mt-6 p-4 bg-red-100 dark:bg-red-900/20 border border-red-400 text-red-700 dark:text-red-300 rounded-lg flex items-center">
              <AlertTriangle className="w-5 h-5 mr-3 flex-shrink-0" />
              <div>
                <p className="font-bold">Error Processing File</p>
                <p className="text-sm">{error}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-sans">
      <div className="container mx-auto p-4 sm:p-6 lg:p-8">
        <header className="mb-8">
          <div className="flex flex-col sm:flex-row justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-800 dark:text-white">
                P&L Analysis Dashboard
              </h1>
              <p className="text-md text-gray-500 dark:text-gray-400">
                Welcome, {clientName}
              </p>
            </div>
            <div className="flex items-center gap-4 mt-4 sm:mt-0">
              <nav>
                <div className="flex space-x-2 bg-white dark:bg-gray-800 p-2 rounded-full shadow-md">
                  <button
                    onClick={() => setPage("summary")}
                    className={`px-4 py-2 text-sm font-semibold rounded-full transition-all duration-300 ${
                      page === "summary"
                        ? "bg-indigo-500 text-white shadow-lg"
                        : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                    }`}
                  >
                    P&L Summary
                  </button>
                  <button
                    onClick={() => setPage("transactions")}
                    className={`px-4 py-2 text-sm font-semibold rounded-full transition-all duration-300 ${
                      page === "transactions"
                        ? "bg-indigo-500 text-white shadow-lg"
                        : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                    }`}
                  >
                    All Transactions
                  </button>
                </div>
              </nav>
              <button
                onClick={resetApp}
                className="p-2 text-gray-500 hover:text-indigo-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
                title="Import new file"
              >
                <RefreshCw className="w-5 h-5" />
              </button>
            </div>
          </div>
        </header>

        <main>
          {page === "summary" && (
            <SummaryPage
              equityPnL={equityPnL}
              mutualFundsPnL={mutualFundsPnL}
            />
          )}
          {page === "transactions" && (
            <TransactionsPage transactions={transactions} />
          )}
        </main>

        <footer className="text-center mt-12 text-sm text-gray-400 dark:text-gray-500">
          <p>
            Generated on{" "}
            {new Date().toLocaleDateString("en-GB", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>
          <p>
            This is a visual representation of your P&L statement. Not for tax
            filing.
          </p>
        </footer>
      </div>
    </div>
  );
}
