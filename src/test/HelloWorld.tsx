import React from 'react'

export interface HelloWorldProps {
  name?: string
}

export const HelloWorld: React.FC<HelloWorldProps> = ({ name = 'World' }) => {
  return (
    <div className="hello-world">
      <h1>Hello {name}</h1>
    </div>
  )
}
