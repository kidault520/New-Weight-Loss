interface NutritionItem {
  name: string
  value: string
  color: string
}

interface FoodItem {
  name: string
  amount: string
  calories: number
  icon: string
}

interface MealCardProps {
  image: string
  calories: number
  tag: string
  tagColor: string
  nutrition: NutritionItem[]
  foods: FoodItem[]
  status?: string
  onExpand?: () => void
  expanded?: boolean
}

export function MealCard({
  image,
  calories,
  tag,
  tagColor,
  nutrition,
  foods,
}: MealCardProps) {
  return (
    <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
      <div className="relative">
        <img 
          src={image} 
          alt={tag} 
          className="w-full h-48 object-cover"
        />
        <div className="absolute top-4 right-4 bg-black/60 rounded-lg p-3 text-white text-xs">
          {nutrition.map((item, index) => (
            <div key={index} className="flex items-center justify-between mb-1 last:mb-0">
              <div className="flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full ${item.color}`}></div>
                <span>{item.name}</span>
              </div>
              <span className="ml-4">{item.value}</span>
            </div>
          ))}
        </div>
      </div>
      
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-black rounded-full"></div>
            <span className="text-xl font-medium">{calories} kcal</span>
          </div>
          <span className={`${tagColor} text-white px-2 py-0.5 rounded-md font-medium text-base`}>
            {tag}
          </span>
        </div>
        
        <div className="space-y-3">
          {foods.map((food, index) => (
            <div key={index} className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center text-lg">
                  {food.icon}
                </div>
                <div>
                  <div className="font-medium text-sm text-gray-800">{food.name}</div>
                  <div className="text-xs text-gray-500">{food.amount}</div>
                </div>
              </div>
              <div className="flex items-center space-x-1">
                <div className="w-2 h-2 bg-black rounded-full"></div>
                <span className="font-bold text-sm">{food.calories}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}














