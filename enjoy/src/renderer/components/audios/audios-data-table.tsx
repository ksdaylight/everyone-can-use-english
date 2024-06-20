import * as React from "react";
import { t } from "i18next";
import {
  ColumnDef,
  SortingState,
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  flexRender,
  ColumnFiltersState,
  VisibilityState,
  getFilteredRowModel,
} from "@tanstack/react-table";
import {
  ArrowUpDown,
  ChevronDown,
  EditIcon,
  TrashIcon,
  CheckCircleIcon,
  AudioWaveformIcon,
} from "lucide-react";
import {
  Button,
  Input,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  PingPoint,
  Checkbox,
} from "@renderer/components/ui";
import dayjs from "@renderer/lib/dayjs";
import { secondsToTimestamp } from "@renderer/lib/utils";
import { Link } from "react-router-dom";
import { trim } from "lodash";

export const AudiosDataTable = (props: {
  audios: Partial<AudioType>[];
  onEdit: (audio: Partial<AudioType>) => void;
  onDelete: (audio: Partial<AudioType>) => void;
  onTranscribe: (audio: Partial<AudioType>) => void;
  onSearchTermChange: (searchString: string) => void;
}) => {
  const { audios, onEdit, onDelete, onTranscribe, onSearchTermChange } = props;

  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    []
  );
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = React.useState({});

  const columns: ColumnDef<Partial<AudioType>>[] = [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && "indeterminate")
          }
          onCheckedChange={(value: any) =>
            table.toggleAllPageRowsSelected(!!value)
          }
          aria-label="Select all"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value: any) => row.toggleSelected(!!value)}
          aria-label="Select row"
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: "name",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          {t("models.audio.name")}
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>
              <Link to={`/audios/${row.original.id}`}>
                <div className="cursor-pointer truncate max-w-[12rem]">
                  {row.original.name}
                </div>
              </Link>
            </TooltipTrigger>
            <TooltipContent>
              <div className="p-2">
                <p className="text-sm">{row.original.name}</p>
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ),
    },
    {
      accessorKey: "duration",
      header: () => (
        <div className="text-right">{t("models.audio.duration")}</div>
      ),
      cell: ({ row }) => (
        <div className="text-right">
          {secondsToTimestamp(row.original.duration)}
        </div>
      ),
    },
    {
      accessorKey: "recordingsCount",
      header: () => (
        <div className="text-right">{t("models.audio.recordingsCount")}</div>
      ),
      cell: ({ row }) => (
        <div className="text-right">{row.original.recordingsCount}</div>
      ),
    },
    {
      accessorKey: "recordingsDuration",
      header: () => (
        <div className="text-right">{t("models.audio.recordingsDuration")}</div>
      ),
      cell: ({ row }) => (
        <div className="text-right">
          {secondsToTimestamp(row.original.recordingsDuration / 1000)}
        </div>
      ),
    },
    {
      accessorKey: "createdAt",
      header: () => (
        <div className="text-right">{t("models.audio.createdAt")}</div>
      ),
      cell: ({ row }) => (
        <div className="text-right">
          {dayjs(row.original.createdAt).format("YYYY-MM-DD HH:mm")}
        </div>
      ),
    },
    {
      accessorKey: "transcribed",
      header: () => (
        <div className="text-right">{t("models.audio.isTranscribed")}</div>
      ),
      cell: ({ row }) =>
        row.original.transcribing ? (
          <PingPoint colorClassName="bg-yellow-500" />
        ) : row.original.transcribed ? (
          <CheckCircleIcon className="text-green-500 w-4 h-4" />
        ) : (
          <PingPoint colorClassName="bg-gray-500" />
        ),
    },
    {
      id: "actions",
      header: () => <div>{t("actions")}</div>,
      cell: ({ row }) => {
        const audio = row.original;
        return (
          <div className="flex items-center">
            <Button
              title={t("transcribe")}
              variant="ghost"
              onClick={() => onTranscribe(audio)}
            >
              <AudioWaveformIcon className="h-4 w-4" />
            </Button>
            <Button
              title={t("edit")}
              variant="ghost"
              onClick={() => onEdit(audio)}
            >
              <EditIcon className="h-4 w-4" />
            </Button>
            <Button
              title={t("delete")}
              variant="ghost"
              onClick={() => onDelete(audio)}
            >
              <TrashIcon className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        );
      },
    },
  ];

  const table = useReactTable({
    data: audios,
    columns,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
    },
    initialState: {
      pagination: {
        pageSize: 20, // 设置每页显示20条记录
      },
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="w-full">
      <div className="flex items-center py-4">
        <Input
          placeholder={t("filter_name")}
          value={(table.getColumn("name")?.getFilterValue() as string) ?? ""}
          onChange={(event) => {
            onSearchTermChange(trim(event.target.value));
            table.getColumn("name")?.setFilterValue(trim(event.target.value));
          }}
          className="max-w-sm"
        />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="ml-auto">
              Columns <ChevronDown className="ml-2 h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {table
              .getAllColumns()
              .filter((column) => column.getCanHide())
              .map((column) => (
                <DropdownMenuCheckboxItem
                  key={column.id}
                  className="capitalize"
                  checked={column.getIsVisible()}
                  onCheckedChange={(value) => column.toggleVisibility(!!value)}
                >
                  {column.id}
                </DropdownMenuCheckboxItem>
              ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  {t("no_results")}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-end space-x-2 py-4">
        <div className="flex-1 text-sm text-muted-foreground">
          {table.getFilteredSelectedRowModel().rows.length} of{" "}
          {table.getFilteredRowModel().rows.length} {t("rows_selected")}.
        </div>
        <div className="space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            {t("previous")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            {t("next")}
          </Button>
        </div>
      </div>
    </div>
  );
};
