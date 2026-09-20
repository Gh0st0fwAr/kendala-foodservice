"use client"

import type React from "react"

import { Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface AdminMenuTabProps {
  onMenuFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void
  onMenuUpload: () => void
}

export function AdminMenuTab({ onMenuFileChange, onMenuUpload }: AdminMenuTabProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Загрузка меню на неделю</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="menu-file">Выберите файл Excel (.xlsx)</Label>
          <Input
            id="menu-file"
            type="file"
            accept=".xlsx"
            onChange={onMenuFileChange}
            className="mt-2"
          />
        </div>
        <div className="text-sm text-gray-600">
          <p>Формат файла:</p>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>
              Колонка day с номерами для каждого дня недели (Понедельник - 1 ... Пятница - 5)
            </li>
            <li>
              3 блюда (2 варианта) на каждый день + напиток (2 варианта) = 8 строк на день
            </li>
            <li>
              Десерт дня (опционально): 9-я строка на день <strong>или</strong> колонка type/category =
              dessert
            </li>
            <li>Колонки: day, name, description, calories [, type]</li>
          </ul>
        </div>
        <Button className="flex items-center gap-2" onClick={onMenuUpload}>
          <Upload className="h-4 w-4" />
          Загрузить меню
        </Button>
      </CardContent>
    </Card>
  )
}
