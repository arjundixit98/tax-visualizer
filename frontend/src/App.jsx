import React, { useState, useMemo } from "react";
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
import {
  ArrowUp,
  ArrowDown,
  TrendingUp,
  TrendingDown,
  ChevronsUpDown,
  ArrowLeft,
  UploadCloud,
  File,
  X,
} from "lucide-react";

// --- HELPER FUNCTIONS & COMPONENTS ---

// Formats numbers to currency string (e.g., ₹1,23,456.78)
const formatCurrency = (value) => {
  if (typeof value !== "number") return "₹0.00";
  const isNegative = value < 0;
  const absoluteValue = Math.abs(value);
  const formatted = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(absoluteValue);
  return isNegative ? `-${formatted}` : formatted;
};

// Custom Tooltip for Charts
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white/80 backdrop-blur-sm p-3 rounded-lg shadow-lg border border-gray-200">
        <p className="font-bold text-gray-800">{label}</p>
        <p
          className={`text-sm ${
            payload[0].value >= 0 ? "text-green-600" : "text-red-600"
          }`}
        >
          Profit: {formatCurrency(payload[0].value)}
        </p>
      </div>
    );
  }
  return null;
};

// Summary Card Component
const SummaryCard = ({ title, value, term, icon }) => {
  const isPositive = value >= 0;
  const Icon = icon;
  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <Icon
            className={`w-5 h-5 ${
              isPositive ? "text-green-500" : "text-red-500"
            }`}
          />
        </div>
        <p
          className={`text-3xl font-bold ${
            isPositive ? "text-gray-800" : "text-red-600"
          }`}
        >
          {formatCurrency(value)}
        </p>
      </div>
      <div className="mt-4 flex justify-between items-center text-xs text-gray-500">
        <span>Short: {formatCurrency(term.short)}</span>
        <span>Long: {formatCurrency(term.long)}</span>
      </div>
    </div>
  );
};

// Generic Table Sorter Hook
const useSortableTable = (data, columns) => {
  const [sortConfig, setSortConfig] = useState({
    key: "profit",
    direction: "ascending",
  });

  const sortedItems = useMemo(() => {
    let sortableItems = [...data];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        if (a[sortConfig.key] < b[sortConfig.key]) {
          return sortConfig.direction === "ascending" ? -1 : 1;
        }
        if (a[sortConfig.key] > b[sortConfig.key]) {
          return sortConfig.direction === "ascending" ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableItems;
  }, [data, sortConfig]);

  const requestSort = (key) => {
    let direction = "ascending";
    if (sortConfig.key === key && sortConfig.direction === "ascending") {
      direction = "descending";
    }
    setSortConfig({ key, direction });
  };

  const getSortIcon = (key) => {
    if (sortConfig.key !== key) {
      return <ChevronsUpDown className="h-4 w-4 text-gray-400 ml-2" />;
    }
    if (sortConfig.direction === "ascending") {
      return <ArrowUp className="h-4 w-4 text-blue-500 ml-2" />;
    }
    return <ArrowDown className="h-4 w-4 text-blue-500 ml-2" />;
  };

  return { items: sortedItems, requestSort, getSortIcon };
};

// Table Header Component
const TableHeader = ({ columns, requestSort, getSortIcon }) => (
  <thead>
    <tr className="bg-gray-50">
      {columns.map((col) => (
        <th
          key={col.accessor}
          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
          onClick={() => requestSort(col.accessor)}
        >
          <div className="flex items-center">
            {col.Header}
            {getSortIcon(col.accessor)}
          </div>
        </th>
      ))}
    </tr>
  </thead>
);

// P&L Details Table Component
const PnlDetailsTable = ({ data, title }) => {
  const columns = useMemo(
    () => [
      { Header: "Symbol", accessor: "symbol" },
      { Header: "Profit", accessor: "profit" },
      { Header: "Buy Value", accessor: "buyValue" },
      { Header: "Sell Value", accessor: "sellValue" },
    ],
    []
  );

  const { items, requestSort, getSortIcon } = useSortableTable(data, columns);

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
      <h3 className="text-xl font-semibold text-gray-800 mb-4">{title}</h3>
      {data.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <TableHeader
              columns={columns}
              requestSort={requestSort}
              getSortIcon={getSortIcon}
            />
            <tbody className="bg-white divide-y divide-gray-200">
              {items.map((item, index) => (
                <tr
                  key={index}
                  className="hover:bg-gray-50 transition-colors duration-150"
                >
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {item.symbol}
                  </td>
                  <td
                    className={`px-6 py-4 whitespace-nowrap text-sm font-semibold ${
                      item.profit >= 0 ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    {formatCurrency(item.profit)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatCurrency(item.buyValue)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatCurrency(item.sellValue)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-gray-500 text-sm mt-2">
          No P&L details to display for this category.
        </p>
      )}
    </div>
  );
};

// Transactions Table Component
const TransactionsTable = ({ data, title }) => {
  const columns = useMemo(
    () => [
      { Header: "Symbol", accessor: "symbol" },
      { Header: "Profit", accessor: "profit" },
      { Header: "Holding Period (Days)", accessor: "holdingPeriod" },
      { Header: "Entry Date", accessor: "entryDate" },
      { Header: "Exit Date", accessor: "exitDate" },
    ],
    []
  );

  const { items, requestSort, getSortIcon } = useSortableTable(data, columns);

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
      <h3 className="text-xl font-semibold text-gray-800 mb-4">{title}</h3>
      {data.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <TableHeader
              columns={columns}
              requestSort={requestSort}
              getSortIcon={getSortIcon}
            />
            <tbody className="bg-white divide-y divide-gray-200">
              {items.map((item, index) => (
                <tr
                  key={index}
                  className="hover:bg-gray-50 transition-colors duration-150"
                >
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {item.symbol}
                  </td>
                  <td
                    className={`px-6 py-4 whitespace-nowrap text-sm font-semibold ${
                      item.profit >= 0 ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    {formatCurrency(item.profit)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {item.holdingPeriod}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {item.entryDate}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {item.exitDate}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-gray-500">
          No transactions to display in this category.
        </p>
      )}
    </div>
  );
};

// --- CHART COMPONENTS ---

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
        className="text-sm"
      >{`${formatCurrency(value)}`}</text>
      <text
        x={ex + (cos >= 0 ? 1 : -1) * 12}
        y={ey}
        dy={18}
        textAnchor={textAnchor}
        fill="#999"
        className="text-xs"
      >
        {`(Rate ${(percent * 100).toFixed(2)}%)`}
      </text>
    </g>
  );
};

const PnlBreakdownChart = ({ data }) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const onPieEnter = (_, index) => {
    setActiveIndex(index);
  };

  const chartData = [
    { name: "Equity", value: data.equityPnL.total },
    { name: "Mutual Funds", value: data.mutualFundsPnL.total },
  ];

  const COLORS = ["#0088FE", "#00C49F"];

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 h-full flex flex-col">
      <h3 className="text-xl font-semibold text-gray-800 mb-4">
        P&L Breakdown
      </h3>
      <div className="flex-grow w-full h-80">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              activeIndex={activeIndex}
              activeShape={renderActiveShape}
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={70}
              outerRadius={90}
              fill="#8884d8"
              dataKey="value"
              onMouseEnter={onPieEnter}
            >
              {chartData.map((entry, index) => (
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
  );
};

const SymbolPerformanceChart = ({ data }) => {
  const chartData = data.map((item) => ({
    name:
      item.symbol.length > 20
        ? `${item.symbol.substring(0, 18)}...`
        : item.symbol,
    profit: item.profit,
  }));

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
      <h3 className="text-xl font-semibold text-gray-800 mb-4">
        Symbol Performance (All P&L)
      </h3>
      <div className="w-full h-80">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            margin={{ top: 5, right: 20, left: 40, bottom: 60 }}
            barSize={20}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="name"
              angle={-45}
              textAnchor="end"
              interval={0}
              height={100}
              tick={{ fontSize: 10 }}
            />
            <YAxis
              tickFormatter={(value) =>
                new Intl.NumberFormat("en-IN", {
                  notation: "compact",
                  compactDisplay: "short",
                }).format(value)
              }
              tick={{ fontSize: 12 }}
            />
            <Tooltip
              content={<CustomTooltip />}
              cursor={{ fill: "rgba(240, 240, 240, 0.5)" }}
            />
            <Legend wrapperStyle={{ fontSize: "12px" }} />
            <Bar dataKey="profit" name="Profit/Loss">
              {chartData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.profit >= 0 ? "#22c55e" : "#ef4444"}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

// --- PAGE COMPONENTS ---

const UploadPage = ({ onUpload, isLoading, error }) => {
  const [selectedFile, setSelectedFile] = useState(null);

  const handleFileChange = (event) => {
    setSelectedFile(event.target.files[0]);
  };

  const handleUploadClick = () => {
    if (selectedFile) {
      onUpload(selectedFile);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh]">
      <div className="w-full max-w-lg p-8 bg-white rounded-2xl shadow-lg border border-gray-100 text-center">
        <UploadCloud className="mx-auto h-16 w-16 text-blue-500 mb-4" />
        <h2 className="text-2xl font-bold text-gray-800 mb-2">
          Upload Your P&L Report
        </h2>
        <p className="text-gray-500 mb-6">
          Please upload your Excel file to get started.
        </p>

        <div className="mb-6">
          <label
            htmlFor="file-upload"
            className="relative cursor-pointer bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold py-3 px-4 rounded-lg inline-block w-full text-center border-2 border-dashed border-blue-200"
          >
            <span className="truncate">
              {selectedFile ? selectedFile.name : "Select a file..."}
            </span>
            <input
              id="file-upload"
              name="file-upload"
              type="file"
              className="sr-only"
              onChange={handleFileChange}
              accept=".xlsx, .xls"
            />
          </label>
          {selectedFile && (
            <div className="mt-4 flex items-center justify-center bg-gray-100 p-3 rounded-lg">
              <File className="h-5 w-5 text-gray-500 mr-2" />
              <span className="text-sm text-gray-700 font-medium truncate">
                {selectedFile.name}
              </span>
              <button
                onClick={() => setSelectedFile(null)}
                className="ml-auto text-gray-500 hover:text-red-500"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          )}
        </div>

        <button
          onClick={handleUploadClick}
          disabled={!selectedFile || isLoading}
          className="w-full bg-blue-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all duration-300 flex items-center justify-center"
        >
          {isLoading ? (
            <>
              <svg
                className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              Processing...
            </>
          ) : (
            "Upload and Analyze"
          )}
        </button>
        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      </div>
    </div>
  );
};

const DashboardPage = ({ data }) => {
  const { equityPnL, mutualFundsPnL, pnlDetails } = data;
  const totalPnL = equityPnL.total + mutualFundsPnL.total;

  // Filter P&L Details
  const equityShortTerm = pnlDetails.filter(
    (d) => d.type === "Equity" && d.term === "Short Term"
  );
  const equityLongTerm = pnlDetails.filter(
    (d) => d.type === "Equity" && d.term === "Long Term"
  );
  const mfShortTerm = pnlDetails.filter(
    (d) => d.type === "Mutual Fund" && d.term === "Short Term"
  );
  const mfLongTerm = pnlDetails.filter(
    (d) => d.type === "Mutual Fund" && d.term === "Long Term"
  );

  return (
    <main className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <SummaryCard
            title="Total P&L"
            value={totalPnL}
            term={{
              short: equityPnL.shortTerm + mutualFundsPnL.shortTerm,
              long: equityPnL.longTerm + mutualFundsPnL.longTerm,
            }}
            icon={totalPnL >= 0 ? TrendingUp : TrendingDown}
          />
          <SummaryCard
            title="Equity P&L"
            value={equityPnL.total}
            term={{ short: equityPnL.shortTerm, long: equityPnL.longTerm }}
            icon={equityPnL.total >= 0 ? TrendingUp : TrendingDown}
          />
          <SummaryCard
            title="Mutual Funds P&L"
            value={mutualFundsPnL.total}
            term={{
              short: mutualFundsPnL.shortTerm,
              long: mutualFundsPnL.longTerm,
            }}
            icon={mutualFundsPnL.total >= 0 ? TrendingUp : TrendingDown}
          />
        </div>
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-gray-700">
            P&L Details Breakdown
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <PnlDetailsTable
              data={equityShortTerm}
              title="Equity - Short Term"
            />
            <PnlDetailsTable data={equityLongTerm} title="Equity - Long Term" />
            <PnlDetailsTable
              data={mfShortTerm}
              title="Mutual Funds - Short Term"
            />
            <PnlDetailsTable
              data={mfLongTerm}
              title="Mutual Funds - Long Term"
            />
          </div>
        </div>
      </div>
      <div className="lg:col-span-1 space-y-6">
        <PnlBreakdownChart data={data} />
        <SymbolPerformanceChart data={pnlDetails} />
      </div>
    </main>
  );
};

const TransactionsPage = ({ data, onBack }) => {
  const equityTransactions = data.filter((tx) => tx.type === "Equity");
  const mutualFundTransactions = data.filter((tx) => tx.type === "Mutual Fund");

  return (
    <main>
      <button
        onClick={onBack}
        className="flex items-center gap-2 mb-6 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors"
      >
        <ArrowLeft className="w-5 h-5" />
        Back to Dashboard
      </button>
      <div className="space-y-8">
        <TransactionsTable
          data={equityTransactions}
          title="Equity Transactions"
        />
        <TransactionsTable
          data={mutualFundTransactions}
          title="Mutual Fund Transactions"
        />
      </div>
    </main>
  );
};

// --- MAIN APP COMPONENT ---

export default function App() {
  const [portfolioData, setPortfolioData] = useState(null);
  const [currentPage, setCurrentPage] = useState("dashboard");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleFileUpload = async (file) => {
    setIsLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("http://127.0.0.1:8000/process-pnl", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ detail: "An unknown error occurred." }));
        throw new Error(
          errorData.detail || `HTTP error! status: ${response.status}`
        );
      }

      const data = await response.json();
      setPortfolioData(data);
      setCurrentPage("dashboard");
    } catch (err) {
      console.error("Upload failed:", err);
      setError(
        err.message || "Failed to upload or process the file. Please try again."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const resetApp = () => {
    setPortfolioData(null);
    setError(null);
    setIsLoading(false);
  };

  if (!portfolioData) {
    return (
      <div className="bg-gray-50 min-h-screen font-sans">
        <div className="container mx-auto p-4 sm:p-6 lg:p-8">
          <UploadPage
            onUpload={handleFileUpload}
            isLoading={isLoading}
            error={error}
          />
        </div>
      </div>
    );
  }

  const { clientName, transactions } = portfolioData;

  const navigateTo = (page) => {
    setCurrentPage(page);
  };

  return (
    <div className="bg-gray-50 min-h-screen font-sans">
      <div className="container mx-auto p-4 sm:p-6 lg:p-8">
        <header className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold text-gray-800">
              Welcome, {clientName}
            </h1>
            <p className="text-lg text-gray-500">
              Here's your portfolio performance overview.
            </p>
          </div>
          <button
            onClick={resetApp}
            className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded-lg transition-colors"
          >
            Upload New File
          </button>
        </header>

        <nav className="mb-8 flex gap-4 border-b">
          <button
            onClick={() => navigateTo("dashboard")}
            className={`py-3 px-1 text-sm font-medium transition-colors ${
              currentPage === "dashboard"
                ? "border-b-2 border-blue-600 text-blue-600"
                : "text-gray-500 hover:text-blue-600"
            }`}
          >
            Dashboard
          </button>
          <button
            onClick={() => navigateTo("transactions")}
            className={`py-3 px-1 text-sm font-medium transition-colors ${
              currentPage === "transactions"
                ? "border-b-2 border-blue-600 text-blue-600"
                : "text-gray-500 hover:text-blue-600"
            }`}
          >
            Transactions
          </button>
        </nav>

        {currentPage === "dashboard" && <DashboardPage data={portfolioData} />}
        {currentPage === "transactions" && (
          <TransactionsPage
            data={transactions}
            onBack={() => navigateTo("dashboard")}
          />
        )}
      </div>
    </div>
  );
}
