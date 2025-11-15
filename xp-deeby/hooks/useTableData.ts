/**
 * Hook for loading table data from a database
 * 
 * Handles all database-specific logic: connections, queries, caching.
 * Returns generic data structures that the TableViewer can consume.
 */

import { useState, useEffect, useCallback } from 'react';
import { sql } from 'drizzle-orm';
import {getAdapterByType, getDatabaseRegistryEntries} from "../adapters";

export interface TableColumn {
  name: string;
  label?: string;
}

export interface TableRow {
  id: string;
  [key: string]: any;
}

export interface UseTableDataOptions {
  dbName: string;
  tableName: string;
  page: number;
  pageSize: number;
  sortBy: string | null;
  sortOrder: 'asc' | 'desc';
  filter: string;
}

export interface UseTableDataResult {
  columns: TableColumn[];
  rows: TableRow[];
  totalRowCount: number;
  loading: boolean;
  error: string | null;
}

export function useTableData(options: UseTableDataOptions): UseTableDataResult {
  const { dbName, tableName, page, pageSize, sortBy, sortOrder, filter } = options;
  
  const [columns, setColumns] = useState<TableColumn[]>([]);
  const [rows, setRows] = useState<TableRow[]>([]);
  const [totalRowCount, setTotalRowCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Cache for table data
  const [tableDataCache, setTableDataCache] = useState<Record<string, {
    columns: TableColumn[];
    rows: TableRow[];
    totalRowCount: number;
    timestamp: number;
  }>>({});
  
  const loadTableData = useCallback(async (targetTable?: string, useCache = true) => {
    const currentTable = targetTable || tableName;
    if (!dbName || !currentTable) return;
    
    // Check cache first
    const cacheKey = `${currentTable}-${page}-${pageSize}-${sortBy}-${sortOrder}-${filter}`;
    if (useCache && tableDataCache[cacheKey]) {
      const cached = tableDataCache[cacheKey];
      if (Date.now() - cached.timestamp < 30000) {
        setColumns(cached.columns);
        setRows(cached.rows);
        setTotalRowCount(cached.totalRowCount);
        setLoading(false);
        return;
      }
    }
    
    try {
      setLoading(true);
      setError(null);
      
      // Get adapter type from registry
      const entries = await getDatabaseRegistryEntries();
      const entry = entries.find((e: any) => e.name === dbName);
      
      if (!entry) {
        setError(`Database ${dbName} not found in registry`);
        setLoading(false);
        return;
      }
      
      // Connect to database
      const adapter = await getAdapterByType(entry.adapterType);
      if (!adapter.getDatabaseByName) {
        setError(`Adapter ${entry.adapterType} does not support getDatabaseByName`);
        setLoading(false);
        return;
      }
      
      const database = await adapter.getDatabaseByName(dbName);
      
      // Get column information
      const columnInfo = await database.execute(sql.raw(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = '${currentTable}'
        ORDER BY ordinal_position
      `)) as any[];
      
      const tableColumns: TableColumn[] = columnInfo.map((col: any) => {
        const colName = col.column_name || col['column_name'] || col[0];
        return { name: colName };
      }).filter(Boolean);
      
      // Get total row count (with filter if applicable)
      let countQuery = `SELECT COUNT(*) as count FROM "${currentTable}"`;
      if (filter && filter.trim()) {
        const filterLower = filter.toLowerCase();
        const columnFilters = tableColumns.map(col => 
          `LOWER(CAST("${col.name}" AS TEXT)) LIKE '%${filterLower.replace(/'/g, "''")}%'`
        ).join(' OR ');
        countQuery += ` WHERE (${columnFilters})`;
      }
      
      console.log(`[useTableData] Count query for ${currentTable}:`, countQuery);
      const countResult = await database.execute(sql.raw(countQuery)) as any[];
      console.log(`[useTableData] Count result for ${currentTable}:`, countResult);
      const totalCount = countResult[0]?.count || countResult[0]?.['count'] || countResult[0]?.[0] || 0;
      const parsedTotalCount = typeof totalCount === 'number' ? totalCount : parseInt(String(totalCount), 10);
      console.log(`[useTableData] Parsed totalCount for ${currentTable}:`, parsedTotalCount, 'from raw:', countResult[0]);
      
      // Build query with sorting and filtering
      let query = `SELECT * FROM "${currentTable}"`;
      const conditions: string[] = [];
      
      // Apply text filter if provided
      if (filter && filter.trim()) {
        const filterLower = filter.toLowerCase();
        const columnFilters = tableColumns.map(col => 
          `LOWER(CAST("${col.name}" AS TEXT)) LIKE '%${filterLower.replace(/'/g, "''")}%'`
        ).join(' OR ');
        conditions.push(`(${columnFilters})`);
      }
      
      if (conditions.length > 0) {
        query += ` WHERE ${conditions.join(' AND ')}`;
      }
      
      // Apply sorting
      if (sortBy && tableColumns.some(col => col.name === sortBy)) {
        query += ` ORDER BY "${sortBy}" ${sortOrder.toUpperCase()}`;
      }
      
      // Apply pagination
      const offset = (page - 1) * pageSize;
      query += ` LIMIT ${pageSize} OFFSET ${offset}`;
      
      console.log(`[useTableData] Data query for ${currentTable}:`, query);
      const queryRows = await database.execute(sql.raw(query)) as any[];
      console.log(`[useTableData] Data query result for ${currentTable}:`, queryRows.length, 'rows');
      console.log(`[useTableData] First row sample:`, queryRows[0]);
      
      // Convert to TableRow format
      const tableRows: TableRow[] = queryRows.map((row, index) => ({
        id: row.id || `row-${currentTable}-${offset + index}`,
        ...row,
      }));
      
      // Only update if this is the active table
      if (currentTable === tableName) {
        setColumns(tableColumns);
        setRows(tableRows);
        setTotalRowCount(parsedTotalCount);
      }
      
      // Cache the data
      setTableDataCache(prev => ({
        ...prev,
        [cacheKey]: {
          columns: tableColumns,
          rows: tableRows,
          totalRowCount: parsedTotalCount,
          timestamp: Date.now(),
        },
      }));
    } catch (err) {
      console.error(`[useTableData] Error loading table data:`, err);
      if (currentTable === tableName) {
        setError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      if (currentTable === tableName) {
        setLoading(false);
      }
    }
  }, [dbName, tableName, page, pageSize, sortBy, sortOrder, filter, tableDataCache]);
  
  // Load data when options change
  useEffect(() => {
    if (dbName && tableName) {
      loadTableData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dbName, tableName, page, pageSize, sortBy, sortOrder, filter]);
  
  return {
    columns,
    rows,
    totalRowCount,
    loading,
    error,
  };
}

