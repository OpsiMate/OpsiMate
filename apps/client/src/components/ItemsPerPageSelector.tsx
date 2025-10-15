import React from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

type ItemsPerPageSelectorProps = {
  setItemsPerPage: (itemsPerPage: number) => void;
  setCurrentPage: (page: number) => void;
}

const ItemsPerPageSelector : React.FC<ItemsPerPageSelectorProps> = ({ setItemsPerPage, setCurrentPage }) => {

  const options = [10, 30, 50, 100] // Options for items per page

  const handleSelectItemChange = (value: string) => {
    const itemsPerPage = parseInt(value, 10)
    setItemsPerPage(itemsPerPage)
    setCurrentPage(1) // Reset to first page on items per page change
  }

  return (
    <Select defaultValue="10" onValueChange={handleSelectItemChange}>
      <SelectTrigger className="w-[80px] h-8">
        <SelectValue placeholder="10" />
      </SelectTrigger>
      <SelectContent>
        {options.map(option => (
          <SelectItem 
            className='hover:cursor-pointer hover:bg-muted' 
            key={option} 
            value={option.toString()} 
            >
            {option}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export default ItemsPerPageSelector